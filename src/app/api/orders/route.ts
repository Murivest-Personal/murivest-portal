import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {orderSchema} from '@/lib/validation'
import {audit, notify, makeReference} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'

/** GET — order history with payment state. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const orders = await db.order.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {createdAt: 'desc'},
    include: {payments: {orderBy: {createdAt: 'desc'}}},
  })
  return NextResponse.json({ok: true, orders})
}

/**
 * POST — place a brief order (catalog, auction, off-market or custom
 * request). Status flow: pending → awaiting_payment → payment_confirmed →
 * processing → ready → delivered. Free digital briefs go straight to
 * processing for fulfilment by the Murivest desk.
 */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, orderSchema)
  if ('response' in parsed) return parsed.response
  const o = parsed.data

  if (o.format === 'hard_copy' && !o.shippingAddress) {
    return NextResponse.json({ok: false, error: 'A delivery address is required for hard-copy briefs.'}, {status: 400})
  }

  const payable = o.amountKes > 0 || o.amountUsd > 0
  const status = payable ? 'awaiting_payment' : 'processing'

  const order = await db.order.create({
    data: {
      reference: makeReference('ORD'),
      userId: ctx.user.id,
      briefSource: o.briefSource,
      sanityBriefId: o.sanityBriefId ?? null,
      sanityOpportunityId: o.sanityOpportunityId ?? null,
      briefTitle: o.briefTitle,
      briefType: o.briefType,
      format: o.format,
      customScope: o.customScope ?? null,
      amountKes: o.amountKes,
      amountUsd: o.amountUsd,
      currency: o.currency,
      status,
      paymentMethod: o.paymentMethod ?? null,
      contactName: ctx.user.fullName,
      contactEmail: ctx.user.email,
      organisation: ctx.profile?.organisationId ? (await db.organisation.findUnique({where: {id: ctx.profile.organisationId}}))?.name ?? null : null,
      shippingAddress: o.shippingAddress ?? null,
      phone: o.phone ?? ctx.profile?.phone ?? null,
      deliveryMethod: o.format === 'hard_copy' ? 'courier' : 'secure_download',
    },
  })

  await notify({
    userId: ctx.user.id,
    type: 'order_status',
    event: 'order.received',
    title: payable ? 'Order placed — payment pending' : 'Order placed',
    body: payable
      ? `Order ${order.reference} for “${order.briefTitle}” is reserved. Complete payment to begin preparation.`
      : `Your request for “${order.briefTitle}” (${order.reference}) is with our research desk. You will be notified when it is ready in your Document Room.`,
    link: '/portal/orders',
    dedupeKey: `order.received.${order.id}`,
    emailVars: {
      briefTitle: order.briefTitle,
      orderRef: order.reference,
      orderScope: order.briefType === 'custom' && order.customScope ? ` — scope: ${order.customScope.slice(0, 120)}` : '',
      amountLine: payable
        ? `Amount due: ${order.currency} ${(order.currency === 'KES' ? order.amountKes : order.amountUsd).toLocaleString('en-GB')}.`
        : 'No payment is required for this request.',
    },
  })
  await audit({
    actorId: ctx.user.id,
    action: 'order.created',
    entity: 'order',
    entityId: order.id,
    detail: {reference: order.reference, amountKes: o.amountKes, format: o.format, source: o.briefSource},
    ...clientMeta(req),
  })
  return NextResponse.json({ok: true, order})
}
