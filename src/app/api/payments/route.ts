import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, toCamel, nowIso, newId} from '@/lib/supabase'
import {mpesaConfirmationSchema, wireConfirmationSchema} from '@/lib/validation'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {OrderRow} from '@/lib/db-types'

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
 *  CARD_PAYMENT_ENDPOINT/CARD_PAYMENT_KEY are configured; until then the route returns a clear "not yet enabled" state rather than pretending.
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
    const orderRow = unwrapNullable<OrderRow>(
      await supabase
        .from('orders')
        .select('*')
        .eq('id', parsed.data.orderId)
        .eq('user_id', ctx.user.id)
        .maybeSingle(),
      'payments.orderForMpesa',
    )
    if (!orderRow) return fail('Order not found.', 404)
    const order = toCamel(orderRow)
    if (order.status === 'cancelled') return fail('This order was cancelled.', 409)

    const reference = extractMpesaCode(parsed.data.mpesaMessage)
    // NOTE: sequential (no multi-table tx over PostgREST)
    unwrap<null>(
      await supabase.from('payments').insert({
        id: newId(),
        order_id: order.id,
        user_id: ctx.user.id,
        method: 'mpesa',
        amount_kes: order.amountKes,
        amount_usd: order.amountUsd,
        currency: 'KES',
        reference,
        confirmation_raw: parsed.data.mpesaMessage,
        status: 'submitted',
        created_at: nowIso(),
      }),
      'payments.createMpesa',
    )
    // updated_at is maintained by the DB trigger — not set here.
    unwrap<null>(
      await supabase
        .from('orders')
        .update({status: 'payment_confirmed', payment_method: 'mpesa', transaction_id: reference})
        .eq('id', order.id),
      'payments.confirmMpesa',
    )
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
    const orderRow = unwrapNullable<OrderRow>(
      await supabase
        .from('orders')
        .select('*')
        .eq('id', parsed.data.orderId)
        .eq('user_id', ctx.user.id)
        .maybeSingle(),
      'payments.orderForWire',
    )
    if (!orderRow) return fail('Order not found.', 404)
    const order = toCamel(orderRow)
    if (order.status === 'cancelled') return fail('This order was cancelled.', 409)

    // NOTE: sequential (no multi-table tx over PostgREST)
    unwrap<null>(
      await supabase.from('payments').insert({
        id: newId(),
        order_id: order.id,
        user_id: ctx.user.id,
        method: 'wire',
        amount_kes: order.amountKes,
        amount_usd: order.amountUsd,
        currency: order.currency,
        reference: parsed.data.bankReference,
        status: 'submitted',
        created_at: nowIso(),
      }),
      'payments.createWire',
    )
    // updated_at is maintained by the DB trigger — not set here.
    unwrap<null>(
      await supabase
        .from('orders')
        .update({status: 'payment_confirmed', payment_method: 'wire', transaction_id: parsed.data.bankReference})
        .eq('id', order.id),
      'payments.confirmWire',
    )
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
