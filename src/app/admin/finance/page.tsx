import {requireAdminPage} from '@/lib/admin/rbac'
import {resolvePeriod} from '@/lib/admin/period'
import {revenueCardMetrics, revenueBreakdowns, pipelineRevenue, unitEconomics, cohortRevenue, cashVersusRecognised} from '@/lib/admin/revenue'
import RevenueCard from '@/components/admin/RevenueCard'
import {PageHeader, SectionCard} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminFinancePage() {
  const actx = await requireAdminPage()
  if (!actx.can('revenue.view')) {
    return (
      <div>
        <PageHeader eyebrow="Finance" title="Finance & Revenue" />
        <SectionCard title="Access restricted" description="The Finance & Revenue view requires the Finance role or Super Administrator.">
          <p className="text-sm text-muted-foreground">Your role does not include revenue visibility. Contact a Super Administrator if you require access.</p>
        </SectionCard>
      </div>
    )
  }

  const period = resolvePeriod('30d')
  const [card, breakdowns, pipeline, units, cohorts, cash] = await Promise.all([
    revenueCardMetrics(period),
    revenueBreakdowns(period),
    pipelineRevenue(),
    unitEconomics(period),
    cohortRevenue(),
    cashVersusRecognised(period),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Finance & revenue"
        title="Revenue instrument"
        description="The full Revenue Card — recognition ledger, breakdowns, pipeline forecast, unit economics and cohort analysis. Every figure reconciles to orders, payments and refunds."
      />
      <RevenueCard initial={{card, breakdowns, pipeline, units, cohorts, cash}} variant="full" canExport={actx.can('revenue.export')} />

      <SectionCard title="Recognition rules" description="Applied consistently across every view and export" className="mt-8">
        <ul className="grid gap-3 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
          <li>· Revenue is recognised when an order reaches <span className="text-primary">delivered</span> AND has at least one <span className="text-primary">verified payment</span> — one ledger row per order.</li>
          <li>· <span className="text-primary">Cash collected</span> (verified payments) is always shown alongside recognised revenue; the difference is labelled deferred / in transit.</li>
          <li>· Net revenue = gross − payment-processing costs − approved refunds. Processing costs come from the configurable fee schedule (Settings) and are 0 until configured.</li>
          <li>· Refunds flow through a controlled propose → review workflow; approved amounts adjust the ledger without deleting history.</li>
          <li>· Advisor attribution uses the order&apos;s attributed advisor, falling back to the investor&apos;s advisor of record.</li>
          <li>· Exports (CSV / print-to-PDF) reproduce exactly these figures with their period labels.</li>
        </ul>
      </SectionCard>
    </div>
  )
}
