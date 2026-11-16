import type {Metadata} from 'next'
import {supabase, unwrap, unwrapNullable, toCamel, toCamelList} from '@/lib/supabase'
import type {InvestorProfileRow, ScenarioRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import {getCriteria} from '@/lib/portal/data'
import {getOpportunityById} from '@/lib/sanity/queries'
import type {ScenarioInputs} from '@/lib/validation'
import StudioWorkspace from '@/components/portal/studio/StudioWorkspace'
import {EmptyState} from '@/components/brand/primitives'
import {Calculator} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Investment Studio',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalUser()
  const uid = ctx.user.id
  const sp = await searchParams

  const val = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)

  const [criteria, scenarios, equityDefault] = await Promise.all([
    getCriteria(uid),
    supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', {ascending: false})
      .then((res) => toCamelList(unwrap<ScenarioRow[]>(res, 'scenarios.list'))),
    supabase
      .from('investor_profiles')
      .select('equity_available, capital_currency')
      .eq('user_id', uid)
      .maybeSingle()
      .then((res) => {
        const row = unwrapNullable<
          Pick<InvestorProfileRow, 'equity_available' | 'capital_currency'>
        >(res, 'investorProfile.byUser')
        return row ? toCamel(row) : null
      }),
  ])

  // Optional prefill: from an opportunity (?opportunity=<sanityId>) or a
  // saved scenario (?scenario=<id>) — the builder receives the full
  // assumption set and re-computes live.
  let prefill: Partial<ScenarioInputs> | null = null
  let prefillSource: {sanityId: string; title: string} | null = null
  const opportunityId = val('opportunity')
  if (opportunityId) {
    const o = await getOpportunityById(decodeURIComponent(opportunityId), ctx.effectiveTier)
    if (o) {
      prefill = {
        price: o.indicativePrice?.amount ?? 0,
        currency: (o.indicativePrice?.currency || 'USD') as ScenarioInputs['currency'],
        grossIncome: o.financials?.grossIncomeAnnual ?? 0,
        opex: o.financials?.operatingExpenses ?? 0,
        exitCapRatePct: o.financials?.netYieldPct ?? 0,
        equityAvailable: criteria?.equityAvailable ?? equityDefault?.equityAvailable ?? 0,
      }
      prefillSource = {sanityId: o._id, title: o.title}
    }
  }

  const scenarioId = val('scenario')
  let openSavedScenario = false
  if (scenarioId && !opportunityId) {
    const s = scenarios.find((x) => x.id === decodeURIComponent(scenarioId))
    if (s) {
      prefill = s.inputs as ScenarioInputs
      prefillSource = s.sanityOpportunityId ? {sanityId: s.sanityOpportunityId, title: s.opportunityTitle || ''} : null
      openSavedScenario = true
    }
  }

  const savedRows = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    opportunityTitle: s.opportunityTitle,
    sanityOpportunityId: s.sanityOpportunityId,
    inputs: s.inputs as ScenarioInputs,
    summary: (s.summary as SavedSummary) ?? null,
    notes: s.notes,
    updatedAt: s.updatedAt,
  }))

  const initialTab = (val('tab') === 'criteria' ? 'criteria' : openSavedScenario ? 'saved' : 'model') as 'criteria' | 'saved' | 'model'

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">The decision engine</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Investment Studio</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Criteria, capital-gap analysis, financing structures, returns modelling, sensitivities and exit strategies — every calculation transparent, every assumption yours to set and label. Work is saved so sophisticated analysis resumes months later without starting over.
        </p>
      </div>

      {openSavedScenario ? (
        <div className="mb-6 border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs text-primary">Saved scenario loaded into the builder with its full assumption set. Adjust and re-save to update it.</div>
      ) : null}

      <StudioWorkspace
        initialCriteria={criteria}
        savedScenarios={savedRows}
        initialTab={initialTab}
        prefill={prefill}
        prefillSource={prefillSource}
        equityDefault={criteria?.equityAvailable ?? equityDefault?.equityAvailable ?? null}
      />
    </div>
  )
}

interface SavedSummary {
  totalCapitalRequirement?: number
  equityRequired?: number
  irrPct?: number | null
  cashOnCashPct?: number | null
  dscr?: number | null
  equityMultiple?: number | null
  capitalGap?: number
  executableNow?: boolean
}
