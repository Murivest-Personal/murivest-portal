import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, toCamel, nowIso} from '@/lib/supabase'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {OrderRow} from '@/lib/db-types'

type Params = {params: Promise<{id: string}>}

const cancelSchema = z.object({reason: z.string().trim().max(500).optional()})

const CANCELLABLE = ['pending', 'awaiting_payment', 'payment_confirmed', 'processing']

/** POST — cancel an order (only before fulfilment advances). */
export async function POST(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const orderRow = unwrapNullable<OrderRow>(
    await supabase.from('orders').select('*').eq('id', id).eq('user_id', guard.ctx.user.id).maybeSingle(),
    'orders.get',
  )
  const order = orderRow ? toCamel(orderRow) : null
  if (!order) return fail('Order not found.', 404)
  if (!CANCELLABLE.includes(order.status)) {
    return fail('This order can no longer be cancelled. Contact your advisor.', 409)
  }
  const parsed = await parseBody(req, cancelSchema)
  if ('response' in parsed) return parsed.response

  // updated_at is maintained by the DB trigger — not set here.
  unwrap<null>(
    await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: nowIso(),
        cancellation_reason: parsed.data.reason ?? null,
      })
      .eq('id', id),
    'orders.cancel',
  )
  await notify({
    userId: guard.ctx.user.id,
    type: 'order_status',
    title: 'Order cancelled',
    body: `Order ${order.reference} has been cancelled.`,
    link: '/portal/orders',
  })
  await audit({actorId: guard.ctx.user.id, action: 'order.cancelled', entity: 'order', entityId: id, detail: {reference: order.reference}, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
