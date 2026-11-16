import type {Metadata} from 'next'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {CapitalCallRow, PortfolioPositionRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import PortfolioWorkspace, {type PositionRow} from '@/components/portal/portfolio/PortfolioWorkspace'

export const metadata: Metadata = {
  title: 'My investments',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const ctx = await requirePortalUser()
  const positions = toCamelList(
    unwrap<PortfolioPositionRow[]>(
      await supabase.from('portfolio_positions').select('*').eq('user_id', ctx.user.id).order('created_at', {ascending: false}),
      'positions.list',
    ),
  )

  // relation include (capital calls) → separate query + JS join
  const positionIds = positions.map((p) => p.id)
  const capitalCallRows = positionIds.length
    ? toCamelList(
        unwrap<CapitalCallRow[]>(
          await supabase.from('capital_calls').select('*').in('position_id', positionIds).order('due_date', {ascending: true}),
          'capitalCalls.list',
        ),
      )
    : []
  const callsByPosition = new Map<string, typeof capitalCallRows>()
  for (const c of capitalCallRows) {
    const arr = callsByPosition.get(c.positionId) ?? []
    arr.push(c)
    callsByPosition.set(c.positionId, arr)
  }

  const rows: PositionRow[] = positions.map((p) => ({
    id: p.id,
    name: p.name,
    sanityOpportunityId: p.sanityOpportunityId,
    assetClass: p.assetClass,
    geography: p.geography,
    status: p.status,
    acquisitionDate: p.acquisitionDate ?? null,
    purchasePrice: p.purchasePrice,
    currency: p.currency,
    equityDeployed: p.equityDeployed,
    debtAmount: p.debtAmount,
    debtRate: p.debtRate,
    debtMaturity: p.debtMaturity ?? null,
    grossIncomeAnnual: p.grossIncomeAnnual,
    operatingExpenses: p.operatingExpenses,
    noiActual: p.noiActual,
    occupancyPct: p.occupancyPct,
    valuation: p.valuation,
    valuationDate: p.valuationDate ?? null,
    valuationBasis: p.valuationBasis,
    notes: p.notes,
    capitalCalls: (callsByPosition.get(p.id) ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      amount: c.amount,
      currency: c.currency,
      dueDate: c.dueDate ?? null,
      status: c.status,
    })),
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Owned &amp; committed assets</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">My investments</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Actual positions and performance — capital deployed, financing, income actuals, valuations where available — clearly separated from pipeline analysis and illustrative projections. Capital-call tracking and exit planning link back to the Investment Studio.
        </p>
      </div>
      <PortfolioWorkspace positions={rows} />
    </div>
  )
}
