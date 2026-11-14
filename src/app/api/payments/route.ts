import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {mpesaConfirmationSchema, wireConfirmationSchema} from '@/lib/validation'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'

/**
 * Payment submissions.
 *
 *  M-Pesa: the investor pays via Pay Bill (details surfaced from env) and
 *  pastes the confirmation message; Murivest finance verifies before the
 *  order advances (mirrors the established Murivest flow).
 *
 *  Wire: the investor submits the bank reference; finance reconciles.
 *
 *  Card: integration point for the card gateway — enabled when
 *  CARD_PAYMENT_ENDPOINT/CARD_PAYMENT_KEY are configured; until then the
 *  route returns a clear "not yet enabled" state rather than pretending.
 */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const body = await req.json().catch(() => null)
  const method = (body as {method?: string} | null)?.method
  const meta = clientMeta(req)

  if (method === 'mpesa') {
    const parsed = mpesaConfirmationSchema.safeParse(body)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Paste the full M-Pesa confirmation message.')
    const order = await db.order.findFirst({
      where: {id: parsed.data.orderId, userId: ctx.user.id},
      include: {payments: true},
    })
    if (!order) return fail('Order not found.', 404)
    if (order.status === 'cancelled') return fail('This order was cancelled.', 409)

    const reference = extractMpesaCode(parsed.data.mpesaMessage)
    await db.payment.create({
      data: {
        orderId: order.id,
        userId: ctx.user.id,
        method: 'mpesa',
        amountKes: order.amountKes,
        amountUsd: order.amountUsd,
        currency: 'KES',
        reference,
        confirmationRaw: parsed.data.mpesaMessage,
        status: 'submitted',
      },
    })
    await db.order.update({where: {id: order.id}, data: {status: 'payment_confirmed', paymentMethod: 'mpesa', transactionId: reference}})
    await notify({
      userId: ctx.user.id,
      type: 'order_status',
      title: 'Payment confirmation received',
      body: `We are verifying your M-Pesa payment for ${order.reference}. Preparation begins once finance confirms.`,
      link: '/portal/orders',
    })
    await audit({actorId: ctx.user.id, action: 'payment.submitted', entity: 'order', entityId: order.id, detail: {method: 'mpesa', reference}, ...meta})
    return NextResponse.json({ok: true, reference})
  }

  if (method === 'wire') {
    const parsed = wireConfirmationSchema.safeParse(body)
    if (!parsed.success) return fail('Provide the bank transfer reference.')
    const order = await db.order.findFirst({
      where: {id: parsed.data.orderId, userId: ctx.user.id},
    })
    if (!order) return fail('Order not found.', 404)
    if (order.status === 'cancelled') return fail('This order was cancelled.', 409)

    await db.payment.create({
      data: {
        orderId: order.id,
        userId: ctx.user.id,
        method: 'wire',
        amountKes: order.amountKes,
        amountUsd: order.amountUsd,
        currency: order.currency,
        reference: parsed.data.bankReference,
        status: 'submitted',
      },
    })
    await db.order.update({where: {id: order.id}, data: {status: 'payment_confirmed', paymentMethod: 'wire', transactionId: parsed.data.bankReference}})
    await notify({
      userId: ctx.user.id,
      type: 'order_status',
      title: 'Wire reference received',
      body: `Bank reference recorded for ${order.reference}. We will confirm once funds clear.`,
      link: '/portal/orders',
    })
    await audit({actorId: ctx.user.id, action: 'payment.submitted', entity: 'order', entityId: order.id, detail: {method: 'wire', reference: parsed.data.bankReference}, ...meta})
    return NextResponse.json({ok: true})
  }

  if (method === 'card') {
    const endpoint = process.env.CARD_PAYMENT_ENDPOINT
    const key = process.env.CARD_PAYMENT_KEY
    if (!endpoint || !key) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Card processing is not yet enabled on this environment. M-Pesa and bank wire are available; card payments are activated by Murivest on request.',
        },
        {status: 501},
      )
    }
    // Gateway integration point — provider adapter lives in
    // src/lib/payments/card-gateway.ts when Murivest supplies credentials.
    return NextResponse.json({ok: false, error: 'Card gateway adapter not installed.'}, {status: 501})
  }

  return fail('Unknown payment method.')
}

/** Extract the M-Pesa transaction code (format ABC12XYZ34) from a pasted SMS. */
function extractMpesaCode(message: string): string | null {
  const m = message.match(/\b([A-Z0-9]{10})\b/)
  return m ? m[1] : null
}
