import type {Metadata} from 'next'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {ComparisonRow, ScenarioRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import {getDiscoverBySource} from '@/lib/sanity/queries'
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
  const val = (key: string) => (typeof sp[key] === 'string' ? sp[key] : null)

  const [properties, savedIds, scenarioRows, comparisonRows] = await Promise.all([
    getDiscoverBySource('all', ctx.effectiveTier),
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

  const scenarios = scenarioRows.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    inputs: scenario.inputs as ScenarioInputs,
    summary:
      (scenario.summary as
        | {
            totalCapitalRequirement?: number
            equityRequired?: number
            irrPct?: number | null
            cashOnCashPct?: number | null
            dscr?: number | null
            equityMultiple?: number | null
            capitalGap?: number
          }
        | undefined) ?? null,
    updatedAt: scenario.updatedAt,
  }))

  const savedComparisons = comparisonRows.map((comparison) => ({
    id: comparison.id,
    name: comparison.name,
    sanityIds: (comparison.sanityIds as string[]) || [],
    scenarioIds: (comparison.scenarioIds as string[]) || [],
    createdAt: comparison.createdAt,
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Side-by-side underwriting</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Compare</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Institutional comparison workspace — properties, saved Studio scenarios, or both
          at once. Capital requirements, yields, leverage assumptions, projected returns,
          risks and exit considerations in one matrix. Save comparisons for committee
          review.
        </p>
      </div>

      <CompareWorkspace
        opportunities={properties.map((property) => ({
          doc: property,
          saved: savedIds.has(property._id),
        }))}
        scenarios={scenarios}
        savedComparisons={savedComparisons}
        initialAddOpportunity={val('add')}
        initialAddScenario={val('scenario')}
      />
    </div>
  )
}