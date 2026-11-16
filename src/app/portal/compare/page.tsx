import type {Metadata} from 'next'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {ComparisonRow, ScenarioRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import {getOpportunities} from '@/lib/sanity/queries'
import {getSavedIds} from '@/lib/portal/data'
import type {ScenarioInputs} from '@/lib/validation'
import CompareWorkspace from '@/components/portal/CompareWorkspace'

export const metadata: Metadata = {
  title: 'Compare',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalUser()
  const sp = await searchParams
  const val = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null)

  const [opportunities, savedIds, scenarioRows, comparisonRows] = await Promise.all([
    getOpportunities(ctx.effectiveTier),
    getSavedIds(ctx.user.id),
    supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('updated_at', {ascending: false})
      .then((res) => toCamelList(unwrap<ScenarioRow[]>(res, 'scenarios.list'))),
    supabase
      .from('comparisons')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('updated_at', {ascending: false})
      .then((res) => toCamelList(unwrap<ComparisonRow[]>(res, 'comparisons.list'))),
  ])

  const scenarios = scenarioRows.map((s) => ({
    id: s.id,
    name: s.name,
    inputs: s.inputs as ScenarioInputs,
    summary: (s.summary as {totalCapitalRequirement?: number; equityRequired?: number; irrPct?: number | null; cashOnCashPct?: number | null; dscr?: number | null; equityMultiple?: number | null; capitalGap?: number} | undefined) ?? null,
    updatedAt: s.updatedAt,
  }))

  const savedComparisons = comparisonRows.map((c) => ({
    id: c.id,
    name: c.name,
    sanityIds: (c.sanityIds as string[]) || [],
    scenarioIds: (c.scenarioIds as string[]) || [],
    createdAt: c.createdAt,
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Side-by-side underwriting</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Compare</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Institutional comparison workspace — opportunities, saved Studio scenarios, or both at once. Capital requirements, yields, leverage assumptions, projected returns, risks and exit considerations in one matrix. Save comparisons for committee review.
        </p>
      </div>
      <CompareWorkspace
        opportunities={opportunities.map((o) => ({doc: o, saved: savedIds.has(o._id)}))}
        scenarios={scenarios}
        savedComparisons={savedComparisons}
        initialAddOpportunity={val('add')}
        initialAddScenario={val('scenario')}
      />
    </div>
  )
}
