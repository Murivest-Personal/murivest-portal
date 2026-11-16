import {notFound} from 'next/navigation'
import {requireAdminPage} from '@/lib/admin/rbac'
import {orderDetail} from '@/lib/admin/queries'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {UserRow} from '@/lib/db-types'
import OrderDetailWorkspace from '@/components/admin/OrderDetailWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminOrderDetailPage({params}: {params: Promise<{id: string}>}) {
  const actx = await requireAdminPage()
  const {id} = await params
  const detail = await orderDetail(actx, id)
  if (!detail) notFound()

  const staff = toCamelList(
    unwrap<Pick<UserRow, 'id' | 'full_name' | 'email'>[]>(
      await supabase
        .from('users')
        .select('id, full_name, email')
        .in('role', ['advisor', 'admin'])
        .eq('status', 'active')
        .order('full_name', {ascending: true}),
      'users.staff',
    ),
  )

  return (
    <div>
      <PageHeader eyebrow="Orders Engine" title="Order detail" description="Full lifecycle, payment reconciliation, fulfilment and revenue recognition for this order." />
      <OrderDetailWorkspace
        data={{
          order: {
            ...detail.order,
            dueAt: detail.order.dueAt ?? null,
            deliveredAt: detail.order.deliveredAt ?? null,
            closedAt: detail.order.closedAt ?? null,
            cancelledAt: detail.order.cancelledAt ?? null,
            createdAt: detail.order.createdAt,
          },
          investor: {
            user: detail.investor.user,
            profile: detail.investor.profile
              ? {
                  classification: detail.investor.profile.classification,
                  accessTier: detail.investor.profile.accessTier,
                  verificationStatus: detail.investor.profile.verificationStatus,
                  advisorId: detail.investor.profile.advisorId,
                  countryResidence: detail.investor.profile.countryResidence,
                  totalCapacity: detail.investor.profile.totalCapacity,
                  capitalCurrency: detail.investor.profile.capitalCurrency,
                }
              : null,
          },
          payments: detail.payments.map((p) => ({
            ...p,
            verifiedAt: p.verifiedAt ?? null,
            createdAt: p.createdAt,
          })),
          events: detail.events.map((e) => ({...e, createdAt: e.createdAt})),
          notes: detail.notes.map((n) => ({...n, createdAt: n.createdAt})),
          refunds: detail.refunds.map((r) => ({
            ...r,
            createdAt: r.createdAt,
          })),
          revenue: detail.revenue
            ? {
                grossUsd: detail.revenue.grossUsd,
                grossKes: detail.revenue.grossKes,
                processingUsd: detail.revenue.processingUsd,
                refundUsd: detail.revenue.refundUsd,
                netUsd: detail.revenue.netUsd,
                recognisedAt: detail.revenue.recognisedAt,
              }
            : null,
          assignment: detail.assignment,
          staff: staff.map((s) => ({id: s.id, name: s.fullName || s.email})),
          can: {manage: actx.can('orders.manage'), verifyPayments: actx.can('payments.verify'), refunds: actx.can('refunds.manage')},
        }}
      />
    </div>
  )
}
