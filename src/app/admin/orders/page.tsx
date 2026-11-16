import {requireAdminPage} from '@/lib/admin/rbac'
import {orderList} from '@/lib/admin/queries'
import OrdersWorkspace from '@/components/admin/OrdersWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actx = await requireAdminPage()
  const sp = await searchParams
  const status = typeof sp.status === 'string' ? sp.status : ''

  const orders = await orderList(actx, status ? {status} : {})

  return (
    <div>
      <PageHeader
        eyebrow="Core revenue engine"
        title="Orders Engine"
        description="Private & institutional briefs from placement to delivery — payment reconciliation, fulfilment assignment, controlled refunds and automatic revenue recognition, fully audited."
      />
      <OrdersWorkspace
        initial={orders.map((o) => ({
          ...o,
          createdAt: o.createdAt,
          dueAt: o.dueAt ?? null,
          deliveredAt: o.deliveredAt ?? null,
          payment: o.payment
            ? {
                id: o.payment.id,
                status: o.payment.status,
                method: o.payment.method,
                amountUsd: o.payment.amountUsd,
                amountKes: o.payment.amountKes,
                reference: o.payment.reference,
                createdAt: o.payment.createdAt,
              }
            : null,
        }))}
        initialStatus={status}
        canManage={actx.can('orders.manage')}
        canVerifyPayments={actx.can('payments.verify')}
        canExport={actx.can('export.data')}
        staffId={actx.auth.user.id}
      />
    </div>
  )
}
