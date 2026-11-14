import {db} from '@/lib/db'
import type {CriteriaInput} from '@/lib/validation'

/**
 * Shared server-side data helpers for portal pages.
 */

/** The investor's live criteria set (typed for matching & studio reuse). */
export function getCriteria(userId: string): CriteriaInput | null {
  return db.investorCriteria.findUnique({where: {userId}}).then((row) => (row ? {
    currency: row.currency,
    equityAvailable: row.equityAvailable ?? null,
    totalCapacity: row.totalCapacity ?? null,
    minTicket: row.minTicket ?? null,
    maxTicket: row.maxTicket ?? null,
    geographies: (row.geographies as CriteriaInput['geographies']) ?? null,
    assetClasses: (row.assetClasses as CriteriaInput['assetClasses']) ?? null,
    structures: (row.structures as CriteriaInput['structures']) ?? null,
    minGrossYield: row.minGrossYield ?? null,
    minNetYield: row.minNetYield ?? null,
    targetIrr: row.targetIrr ?? null,
    targetCashOnCash: row.targetCashOnCash ?? null,
    targetPaybackYears: row.targetPaybackYears ?? null,
    holdPeriodMin: row.holdPeriodMin ?? null,
    holdPeriodMax: row.holdPeriodMax ?? null,
    leverageComfort: row.leverageComfort ?? null,
    financingOpen: row.financingOpen,
    riskTolerance: (row.riskTolerance as CriteriaInput['riskTolerance']) ?? null,
    exitPreferences: (row.exitPreferences as CriteriaInput['exitPreferences']) ?? null,
  } : null))
}

/** Saved sanity ids for an investor. */
export function getSavedIds(userId: string): Promise<Set<string>> {
  return db.savedOpportunity.findMany({where: {userId}, select: {sanityId: true}}).then((rows) => new Set(rows.map((r) => r.sanityId)))
}

/** View counts per sanity id across authorised investors. */
export function getViewCounts(): Promise<Map<string, number>> {
  return db.opportunityView.groupBy({by: ['sanityId'], _count: {_all: true}}).then((groups) => {
    const map = new Map<string, number>()
    for (const g of groups) map.set(g.sanityId, g._count._all)
    return map
  })
}
