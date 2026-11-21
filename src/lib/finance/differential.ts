import {z} from 'zod'

/**
 * Differential Underwriting engine — the public calculation arsenal.
 *
 * Implements the Murivest method: a deal is underwritten as competing
 * explanations of value rather than one pro forma:
 *   Scenario A — the seller's story (fully let, lean costs, market cap rate)
 *   Scenario B — the in-place reality (today's occupancy, today's costs)
 *   Scenario C — the stabilized case, net of the re-leasing programme
 * The differential spread between consensus (asking price) and the
 * evidence-supported value is the product; the offer ladder converts it
 * into an opening offer, a target zone and a walk-away price anchored in
 * basis points of defensible yield.
 *
 * Pure computation — no database, no session, safe for public use.
 */

export const MARKET_ARCHETYPES = [
  {key: 'gateway_office', label: 'Prime gateway office (NYC · London · SF)', capRatePct: 5.0, debtRatePct: 6.0},
  {key: 'regional_office', label: 'Regional CBD office', capRatePct: 6.5, debtRatePct: 6.5},
  {key: 'industrial', label: 'Industrial & logistics', capRatePct: 5.5, debtRatePct: 6.0},
  {key: 'multifamily', label: 'Stabilised multifamily / living', capRatePct: 5.0, debtRatePct: 6.0},
  {key: 'retail', label: 'Anchored retail', capRatePct: 6.5, debtRatePct: 6.5},
  {key: 'hospitality', label: 'Hospitality (going concern)', capRatePct: 8.0, debtRatePct: 7.5},
  {key: 'emerging_cbd_office', label: 'Emerging-market CBD office (e.g. Nairobi)', capRatePct: 9.0, debtRatePct: 13.5},
  {key: 'custom', label: 'Custom — I know my submarket', capRatePct: 7.0, debtRatePct: 7.0},
] as const

export type MarketArchetypeKey = (typeof MARKET_ARCHETYPES)[number]['key']

export const ARCHETYPE_BY_KEY: Record<string, (typeof MARKET_ARCHETYPES)[number]> = Object.fromEntries(
  MARKET_ARCHETYPES.map((a) => [a.key, a]),
)

export const differentialInputSchema = z.object({
  /** Context — echoed in the report, never stored. */
  propertyName: z.string().trim().max(120).optional().default(''),
  locationNote: z.string().trim().max(120).optional().default(''),
  archetype: z
    .enum(['gateway_office', 'regional_office', 'industrial', 'multifamily', 'retail', 'hospitality', 'emerging_cbd_office', 'custom'])
    .default('emerging_cbd_office'),
  currency: z.enum(['KES', 'USD', 'GBP', 'EUR']).default('KES'),

  /** Asset, income & price. */
  lettableArea: z.number().positive().max(50_000_000), // sq ft
  monthlyIncomeFullyLet: z.number().positive().max(1e12), // gross potential rent / month at 100%
  currentOccupancyPct: z.number().min(0).max(100),
  askingPrice: z.number().min(0).max(1e15),

  /** Market & assumptions. */
  marketCapRatePct: z.number().min(1).max(25),
  targetOccupancyPct: z.number().min(40).max(100).default(85),
  /** The seller's lean-cost assumption for the fully-let story — usually below stabilized. */
  sellerStoryOpexPct: z.number().min(5).max(90).default(30),
  opexRatioInPlacePct: z.number().min(5).max(90).default(45),
  opexRatioStabilizedPct: z.number().min(5).max(90).default(35),

  /** Costs & the re-leasing programme. */
  fitOutPsf: z.number().min(0).max(1e5).default(0), // fit-out contribution per re-let sq ft
  downtimeMonths: z.number().min(0).max(36).default(6), // rent-free / downtime on re-let space

  /** Debt terms. */
  debtRatePct: z.number().min(0.5).max(30).default(13.5),
  amortYears: z.number().int().min(1).max(40).default(15),
  dscrFloor: z.number().min(1).max(3).default(1.3),

  /** Rent-delta calculator (optional re-gear uplift, per sq ft per month). */
  rentDeltaPsf: z.number().min(0).max(1e4).default(0),
})

export type DifferentialInput = z.infer<typeof differentialInputSchema>

export interface ScenarioLine {
  key: 'A' | 'B' | 'C'
  label: string
  occupancyPct: number
  opexRatioPct: number
  effectiveGrossIncome: number
  operatingExpenses: number
  noi: number
  valueAtMarketCap: number
  programmeCost: number
  netValue: number
}

export interface LadderRung {
  rung: 'opening' | 'target' | 'walk-away'
  price: number
  stabilizedYieldPct: number
  note: string
}

export interface DifferentialResult {
  currency: string
  archetype: MarketArchetypeKey
  generatedAt: string
  vitals: {
    grossPotentialRent: number
    inPlaceIncome: number
    rentPsfPerMonth: number
    basisPsfAtAsking: number | null
    grossYieldAtAskingPct: number | null
  }
  scenarios: ScenarioLine[]
  valueBand: {capLowPct: number; capHighPct: number; netValueLow: number; netValueHigh: number}
  inPlaceYieldOnAskingPct: number | null
  impliedCapRateAtAskingPct: number | null
  debt: {
    annualDebtConstantPct: number
    maxAnnualDebtService: number
    maxSupportableLoan: number
    impliedLtvPctOnTargetPrice: number
    dscrStabilizedAtAskingLtv60: number | null
    dscrInPlaceAtAskingLtv60: number | null
  }
  breakevenOccupancyPct: number
  offerLadder: LadderRung[]
  differential: {
    consensusValue: number | null
    differentialValue: number
    spread: number | null
    spreadPctOfAsking: number | null
    executionValue: number
  }
  rentGuidance: {
    currentRentPsfPerMonth: number
    requiredRentPsfToJustifyAsking: number | null
    upliftPsfToCloseSpread: number | null
  }
  rentDelta: {deltaPsf: number; grossValue: number; differentialValue: number}
  yieldOnCostPct: number
  reLeasingProgrammeCost: number
  reLetArea: number
  flags: string[]
}

/** Monthly annuity payment factor: payment per 1 of principal. */
function monthlyPaymentFactor(annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12
  const n = Math.round(years * 12)
  if (n < 1) return 1
  if (r <= 0) return 1 / n
  return r / (1 - Math.pow(1 + r, -n))
}

function scenario(
  key: ScenarioLine['key'],
  label: string,
  occupancyPct: number,
  opexRatioPct: number,
  gpr: number,
  capRateFrac: number,
): ScenarioLine {
  const egi = gpr * (occupancyPct / 100)
  const opex = egi * (opexRatioPct / 100)
  const noi = egi - opex
  const value = capRateFrac > 0 ? noi / capRateFrac : 0
  return {
    key,
    label,
    occupancyPct,
    opexRatioPct,
    effectiveGrossIncome: egi,
    operatingExpenses: opex,
    noi,
    valueAtMarketCap: value,
    programmeCost: 0,
    netValue: value,
  }
}

export function runDifferentialUnderwriting(input: DifferentialInput): DifferentialResult {
  const area = input.lettableArea
  const gpr = input.monthlyIncomeFullyLet * 12
  const rentPsf = input.monthlyIncomeFullyLet / area
  const cap = input.marketCapRatePct / 100
  const asking = input.askingPrice

  // ---- Vitals ------------------------------------------------------------
  const inPlaceIncome = gpr * (input.currentOccupancyPct / 100)
  const vitals = {
    grossPotentialRent: gpr,
    inPlaceIncome,
    rentPsfPerMonth: rentPsf,
    basisPsfAtAsking: asking > 0 ? asking / area : null,
    grossYieldAtAskingPct: asking > 0 ? (gpr / asking) * 100 : null,
  }

  // ---- Three competing explanations of value ------------------------------
  const A = scenario('A', "Seller's story — fully let, lean costs", 100, input.sellerStoryOpexPct, gpr, cap)
  const B = scenario('B', 'In-place reality — today', input.currentOccupancyPct, input.opexRatioInPlacePct, gpr, cap)
  const C = scenario('C', 'Stabilized case — underwritten', input.targetOccupancyPct, input.opexRatioStabilizedPct, gpr, cap)

  // Re-leasing programme: fit-out contribution + downtime gross rent across
  // the space that must actually be let to reach the target occupancy.
  const reLetFraction = Math.max(0, input.targetOccupancyPct - input.currentOccupancyPct) / 100
  const reLetArea = area * reLetFraction
  const programmeCost = reLetArea * input.fitOutPsf + reLetArea * rentPsf * input.downtimeMonths
  C.programmeCost = programmeCost
  C.netValue = C.valueAtMarketCap - programmeCost

  const scenarios = [A, B, C]

  // ---- Cap-rate band (± 0.5pp on the net stabilized value) -----------------
  const bandLowCap = cap + 0.005
  const bandHighCap = Math.max(0.005, cap - 0.005)
  const cNetNoi = C.noi
  const valueBand = {
    capLowPct: bandLowCap * 100,
    capHighPct: bandHighCap * 100,
    netValueLow: cNetNoi / bandLowCap - programmeCost,
    netValueHigh: cNetNoi / bandHighCap - programmeCost,
  }

  // ---- Debt engine ---------------------------------------------------------
  const factor = monthlyPaymentFactor(input.debtRatePct, input.amortYears)
  const annualDebtConstantPct = factor * 12 * 100
  const maxAnnualDebtService = C.noi / input.dscrFloor
  const maxSupportableLoan = annualDebtConstantPct > 0 ? maxAnnualDebtService / (annualDebtConstantPct / 100) : 0

  // Offer ladder prices (yields anchored on the market cap rate).
  const priceAt = (yieldPct: number) => C.noi / (yieldPct / 100)
  const openingPrice = priceAt(input.marketCapRatePct + 2.5)
  const targetLowPrice = priceAt(input.marketCapRatePct + 1.5)
  const targetHighPrice = priceAt(input.marketCapRatePct + 1.0)
  const walkAwayPrice = priceAt(input.marketCapRatePct + 0.5)
  const targetMid = (targetLowPrice + targetHighPrice) / 2

  const offerLadder: LadderRung[] = [
    {
      rung: 'opening',
      price: openingPrice,
      stabilizedYieldPct: (C.noi / openingPrice) * 100,
      note: 'Anchors the negotiation below the target zone — defensible on the as-is or early-stabilization case. Never open above the target zone.',
    },
    {
      rung: 'target',
      price: targetMid,
      stabilizedYieldPct: (C.noi / targetMid) * 100,
      note: `Sign here if possible — the zone carries a 100–150bp execution buffer above the ${input.marketCapRatePct}% market cap rate.`,
    },
    {
      rung: 'walk-away',
      price: walkAwayPrice,
      stabilizedYieldPct: (C.noi / walkAwayPrice) * 100,
      note: 'Hard ceiling, only with every rule-out completed and conditions precedent attached. Above this, re-approach on new facts only.',
    },
  ]

  const debt = {
    annualDebtConstantPct,
    maxAnnualDebtService,
    maxSupportableLoan,
    impliedLtvPctOnTargetPrice: targetMid > 0 ? (maxSupportableLoan / targetMid) * 100 : 0,
    dscrStabilizedAtAskingLtv60:
      asking > 0 ? C.noi / (asking * 0.6 * (annualDebtConstantPct / 100)) : null,
    dscrInPlaceAtAskingLtv60:
      asking > 0 ? B.noi / (asking * 0.6 * (annualDebtConstantPct / 100)) : null,
  }

  // ---- Breakeven occupancy (stabilized opex + maximum supportable debt) ---
  const breakevenOccupancyPct = gpr > 0 ? ((C.operatingExpenses + maxAnnualDebtService) / gpr) * 100 : 0

  // ---- The differential spread --------------------------------------------
  const spread = asking > 0 ? asking - C.netValue : null
  const differential = {
    consensusValue: asking > 0 ? asking : null,
    differentialValue: C.netValue,
    spread,
    spreadPctOfAsking: spread && asking > 0 ? (spread / asking) * 100 : null,
    executionValue: cap > 0 ? (C.noi - B.noi) / cap : 0,
  }

  // ---- Rent guidance — "the price to set to let" ---------------------------
  const requiredRentPsfToJustifyAsking =
    asking > 0 && area > 0 && input.targetOccupancyPct > 0
      ? (asking * cap) / (area * 12 * (input.targetOccupancyPct / 100) * (1 - input.opexRatioStabilizedPct / 100))
      : null
  const upliftPsfToCloseSpread =
    spread && spread > 0 && area > 0
      ? (spread * cap) / (area * 12 * (1 - input.opexRatioStabilizedPct / 100))
      : null
  const rentGuidance = {
    currentRentPsfPerMonth: rentPsf,
    requiredRentPsfToJustifyAsking,
    upliftPsfToCloseSpread,
  }

  // ---- Rent-delta calculator ------------------------------------------------
  const annualDelta = input.rentDeltaPsf * area * 12
  const rentDelta = {
    deltaPsf: input.rentDeltaPsf,
    grossValue: cap > 0 ? annualDelta / cap : 0,
    differentialValue: cap > 0 ? (annualDelta * (1 - input.opexRatioStabilizedPct / 100)) / cap : 0,
  }

  // ---- Yield on cost ---------------------------------------------------------
  const allInBasis = targetMid + programmeCost
  const yieldOnCostPct = allInBasis > 0 ? (C.noi / allInBasis) * 100 : 0

  // ---- Verdict flags ----------------------------------------------------------
  const flags: string[] = []
  if (asking > 0 && A.valueAtMarketCap > 0 && Math.abs(asking - A.valueAtMarketCap) / A.valueAtMarketCap < 0.05) {
    flags.push(
      'The asking price coincides with the fully-let story — it assumes the building is full, the costs are lean, and no time, cost or risk attaches to the journey from ' +
        input.currentOccupancyPct + '% to 100% occupancy. The price is the seller\u2019s story capitalised.',
    )
  }
  if (asking > 0 && C.netValue > 0 && asking > C.netValue * 1.05) {
    flags.push(
      'The asking price sits above the evidence-supported value band — it embeds the fully-let story rather than today\u2019s reality.',
    )
  }
  const impliedCap = asking > 0 ? (C.noi / asking) * 100 : null
  if (impliedCap != null && impliedCap < input.marketCapRatePct - 0.25) {
    flags.push(
      `At the asking price the implied yield on stabilized NOI is ${impliedCap.toFixed(2)}% — below the ${input.marketCapRatePct}% market cap rate you entered.`,
    )
  }
  if (debt.dscrStabilizedAtAskingLtv60 != null && debt.dscrStabilizedAtAskingLtv60 < 1.0) {
    flags.push(
      `A conventional 60% LTV loan on the asking price fails the DSCR test at ${debt.dscrStabilizedAtAskingLtv60.toFixed(2)}× — the debt market vetoes the price.`,
    )
  }
  if (differential.executionValue > 0 && input.targetOccupancyPct - input.currentOccupancyPct > 10) {
    flags.push(
      `The execution gap — lifting occupancy from ${input.currentOccupancyPct}% to ${input.targetOccupancyPct}% — costs ${programmeCost > 0 ? 'the re-leasing programme' : 'downtime'} and creates the majority of the value in this deal.`,
    )
  }
  if (spread != null && asking > 0 && spread / asking < 0.05) {
    flags.push('The asking price and the differential value are close — the market has largely priced this one fairly, so the case rests on execution edge, not mispricing.')
  }
  if (rentDelta.deltaPsf > 0) {
    flags.push(
      `A ${input.rentDeltaPsf}/sq ft/month re-gear uplift capitalises to ${rentDelta.differentialValue.toLocaleString('en-GB', {maximumFractionDigits: 0})} at the differential rule (net of opex) — versus ${rentDelta.grossValue.toLocaleString('en-GB', {maximumFractionDigits: 0})} on the naive gross rule.`,
    )
  }

  return {
    currency: input.currency,
    archetype: input.archetype,
    generatedAt: new Date().toISOString(),
    vitals,
    scenarios,
    valueBand,
    inPlaceYieldOnAskingPct: asking > 0 ? (B.noi / asking) * 100 : null,
    impliedCapRateAtAskingPct: impliedCap,
    debt,
    breakevenOccupancyPct,
    offerLadder,
    differential,
    rentGuidance,
    rentDelta,
    yieldOnCostPct,
    reLeasingProgrammeCost: programmeCost,
    reLetArea,
    flags,
  }
}
