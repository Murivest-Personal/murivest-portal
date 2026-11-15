import {requireAdminPage} from '@/lib/admin/rbac'
import {resolvePeriod} from '@/lib/admin/period'
import {commandCentre} from '@/lib/admin/queries'
import {executiveSnapshot} from '@/lib/admin/analytics'
import {revenueCardMetrics, revenueBreakdowns} from '@/lib/admin/revenue'
import CommandCentre from '@/components/admin/CommandCentre'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminHomePage() {
  const actx = await requireAdminPage()
  const period = resolvePeriod('30d')

  const [centre, exec, card, breakdowns] = await Promise.all([
    commandCentre(actx, period),
    executiveSnapshot(period),
    revenueCardMetrics(period),
    revenueBreakdowns(period),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Internal operations"
        title="Command Centre"
        description={`Real-time snapshot of the Private Capital Portal — ${period.label.toLowerCase()}. Revenue, queues, pipeline and audit activity in one view.`}
      />
      <CommandCentre
        revenue={{card, breakdowns}}
        executive={exec}
        queues={centre.queues}
        activity={centre.activity.map((a) => ({...a, createdAt: a.createdAt.toISOString()}))}
        quickActions={centre.quickActions}
        can={{
          broadcast: actx.can('broadcast.send'),
          orders: actx.can('orders.manage'),
          investors: actx.can('investors.view.all') || actx.can('investors.view.assigned'),
          compliance: actx.can('compliance.view'),
          mandates: actx.can('mandates.view'),
        }}
      />
    </div>
  )
}
