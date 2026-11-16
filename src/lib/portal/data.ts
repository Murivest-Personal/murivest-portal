import {supabase, unwrap, unwrapNullable, toCamel} from '@/lib/supabase'
import type {InvestorCriteriaRow, OpportunityViewRow, SavedOpportunityRow} from '@/lib/db-types'
import type {CriteriaInput} from '@/lib/validation'

/**
 * Shared server-side data helpers for portal pages.
 */

/** The investor's live criteria set (typed for matching & studio reuse). */
export async function getCriteria(userId: string): Promise<CriteriaInput | null> {
  const row = unwrapNullable<InvestorCriteriaRow>(
    await supabase.from('investor_criteria').select('*').eq('user_id', userId).maybeSingle(),
    'investorCriteria.byUser',
  )
  if (!row) return null
  const c = toCamel(row)
  return {
    currency: c.currency as CriteriaInput['currency'],
    equityAvailable: c.equityAvailable ?? null,
    totalCapacity: c.totalCapacity ?? null,
    minTicket: c.minTicket ?? null,
    maxTicket: c.maxTicket ?? null,
    geographies: (c.geographies as CriteriaInput['geographies']) ?? null,
    assetClasses: (c.assetClasses as CriteriaInput['assetClasses']) ?? null,
    structures: (c.structures as CriteriaInput['structures']) ?? null,
    minGrossYield: c.minGrossYield ?? null,
    minNetYield: c.minNetYield ?? null,
    targetIrr: c.targetIrr ?? null,
    targetCashOnCash: c.targetCashOnCash ?? null,
    targetPaybackYears: c.targetPaybackYears ?? null,
    holdPeriodMin: c.holdPeriodMin ?? null,
    holdPeriodMax: c.holdPeriodMax ?? null,
    leverageComfort: c.leverageComfort ?? null,
    financingOpen: c.financingOpen,
    riskTolerance: (c.riskTolerance as CriteriaInput['riskTolerance']) ?? null,
    exitPreferences: (c.exitPreferences as CriteriaInput['exitPreferences']) ?? null,
  }
}

/** Saved sanity ids for an investor. */
export async function getSavedIds(userId: string): Promise<Set<string>> {
  const rows = unwrap<Pick<SavedOpportunityRow, 'sanity_id'>[]>(
    await supabase.from('saved_opportunities').select('sanity_id').eq('user_id', userId),
    'savedOpportunities.byUser',
  )
  return new Set(rows.map((r) => r.sanity_id))
}

/** View counts per sanity id across authorised investors. */
export async function getViewCounts(): Promise<Map<string, number>> {
  // groupBy → plain select + JS aggregation (no multi-column groupBy over PostgREST)
  const rows = unwrap<Pick<OpportunityViewRow, 'sanity_id'>[]>(
    await supabase.from('opportunity_views').select('sanity_id'),
    'opportunityViews.all',
  )
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.sanity_id, (map.get(r.sanity_id) ?? 0) + 1)
  return map
}
