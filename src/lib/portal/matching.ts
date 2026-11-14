import type {OpportunityDoc} from '@/lib/sanity/types'
import type {CriteriaInput} from '@/lib/validation'

/**
 * Server-side opportunity ↔ criteria matching (transparent, rule-based).
 * Produces explainable match reasons — no black-box scoring, no invented
 * data. Missing fields simply do not contribute.
 */

export interface MatchResult {
  score: number // 0–100
  reasons: string[] // human-readable, shown to the investor
  withinBudget: boolean
}

export function matchOpportunity(op: OpportunityDoc, criteria: CriteriaInput | null): MatchResult {
  if (!criteria) return {score: 0, reasons: [], withinBudget: true}

  const reasons: string[] = []
  let points = 0
  const max = 100

  // Asset class (weight 25)
  const wantedClasses = criteria.assetClasses ?? []
  if (wantedClasses.length === 0) {
    points += 12 // no preference — neutral credit
  } else if (op.assetClass && wantedClasses.includes(op.assetClass as never)) {
    points += 25
    reasons.push('Matches your asset-class criteria')
  }

  // Geography (weight 20)
  const wantedGeos = criteria.geographies ?? []
  if (wantedGeos.length === 0) {
    points += 10
  } else {
    const hit = wantedGeos.some((g) => {
      const country = g.country?.toLowerCase()
      const city = g.city?.toLowerCase()
      const opCountry = (op.geography?.country || '').toLowerCase()
      const opCity = (op.geography?.city || '').toLowerCase()
      const opDistrict = (op.geography?.district || '').toLowerCase()
      if (country && opCountry && opCountry.includes(country)) return true
      if (city && (opCity.includes(city) || opDistrict.includes(city))) return true
      return false
    })
    if (hit) {
      points += 20
      reasons.push('Within your target geography')
    }
  }

  // Yield (weight 20)
  const minNet = criteria.minNetYield
  if (minNet == null) {
    points += 10
  } else if (op.financials?.netYieldPct != null && op.financials.netYieldPct >= minNet) {
    points += 20
    reasons.push(`Net yield ${op.financials.netYieldPct.toFixed(2)}% meets your ${minNet}% floor`)
  }

  // Budget (weight 25) — within budget or capital-gap flagged, never a rejection
  const equity = criteria.equityAvailable ?? null
  const price = op.indicativePrice?.amount ?? null
  let withinBudget = true
  if (equity != null && price != null) {
    const currencyMatch = !criteria.currency || criteria.currency === (op.indicativePrice?.currency || 'USD')
    if (currencyMatch && price <= equity) {
      points += 25
      reasons.push('Within your stated equity')
    } else if (currencyMatch) {
      points += 12
      withinBudget = false
      reasons.push('Above stated equity — capital-gap analysis will structure it')
    }
  } else {
    points += 12
  }

  // Structure preference (weight 10)
  const structures = criteria.structures ?? []
  if (structures.length === 0 || (op.dealStructure && structures.includes(op.dealStructure as never))) {
    points += 10
  }

  return {
    score: Math.min(Math.round((points / max) * 100), 100),
    reasons,
    withinBudget,
  }
}
