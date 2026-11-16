import {requireAdminPage} from '@/lib/admin/rbac'
import {resolvePeriod} from '@/lib/admin/period'
import * as analytics from '@/lib/admin/analytics'
import AnalyticsWorkspace from '@/components/admin/AnalyticsWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminAnalyticsPage() {
  await requireAdminPage()
  const period = resolvePeriod('30d')

  const [exec, investors, opportunities, orders, mandates, ops, advisors] = await Promise.all([
    analytics.executiveSnapshot(period),
    analytics.investorAnalytics(period),
    analytics.opportunityAnalytics(period),
    analytics.orderAnalytics(period),
    analytics.mandateAnalytics(period),
    analytics.operationalHealth(period),
    analytics.advisorPerformance(period),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Decision intelligence"
        title="Analytics"
        description="Investors, opportunities, orders, mandates, engagement and operations — computed from real portal interactions, with comparison periods on every metric."
      />
      <AnalyticsWorkspace
        initialPeriod="30d"
        initial={{
          period: {label: period.label, key: period.key},
          executive: exec,
          investors,
          opportunities,
          orders,
          mandates,
          ops,
          advisors,
        }}
      />
    </div>
  )
}
