import {db} from '@/lib/db'
import {growth, inRange, sum, type Period} from './period'

/**
 * Revenue engine — the financial instrument behind the Revenue Card.
 *
 * RECOGNITION RULES (applied consistently across every view):
 *   • Revenue is recognised when an order reaches `delivered` AND has at
 *     least one verified payment → exactly one RevenueEvent per order
 *     (gross, processing cost, refunds, net).
 *   • CASH COLLECTED is derived from verified payments (may precede or
 *     exceed recognised revenue — both are always shown, clearly labelled).
 *   • Net revenue = gross − payment-processing costs − approved refunds.
 *   • Processing costs come from the `payments.fee_schedule` SystemSetting
 *     (percentage per method). When unconfigured they are 0 and labelled
 *     "not configured" — no invented costs.
 *
 * Reporting currency is USD; KES gross is tracked in parallel on each event.
 */

const OPEN_ORDER_STATUSES = ['pending', 'awaiting_payment', 'payment_confirmed', 'processing', 'internal_review', 'ready']

interface FeeSchedule {
  card: number // percent, e.g. 2.9
  mpesa: number
  wire: number
}

async function getFeeSchedule(): Promise<FeeSchedule> {
  const setting = await db.systemSetting.findUnique({where: {key: 'payments.fee_schedule'}})
  const v = (setting?.value ?? {}) as Record<string, unknown>
  return {
    card: typeof v.card === 'number' ? v.card : 0,
    mpesa: typeof v.mpesa === 'number' ? v.mpesa : 0,
    wire: typeof v.wire === 'number' ? v.wire : 0,
  }
}

export async function feeScheduleConfigured(): Promise<boolean> {
  const s = await getFeeSchedule()
  return s.card > 0 || s.mpesa > 0 || s.wire > 0
}

/**
 * Write/refresh the recognition ledger row for an order (called from the
 * `delivered` status transition). Idempotent — recalculates from source rows
 * so the ledger always reconciles with orders + verified payments + refunds.
 */
export async function recogniseRevenue(orderId: string, actorId: string | null): Promise<void> {
  const order = await db.order.findUnique({where: {id: orderId}, include: {payments: true}})
  if (!order || order.status !== 'delivered') return
  const verified = order.payments.filter((p) => p.status === 'verified')
  if (verified.length === 0) return

  const schedule = await getFeeSchedule()
  const grossUsd = order.amountUsd
  const grossKes = order.amountKes
  const processingUsd = verified.reduce((acc, p) => {
    const pct = (schedule as Record<string, number>)[p.method] ?? 0
    return acc + (p.amountUsd * pct) / 100
  }, 0)

  const existing = await db.revenueEvent.findUnique({where: {orderId}})
  const refundUsd = existing?.refundUsd ?? 0
  const netUsd = Math.max(0, grossUsd - processingUsd - refundUsd)

  const data = {
    grossKes,
    grossUsd,
    processingUsd: round2(processingUsd),
    refundUsd,
    netUsd: round2(netUsd),
    recognisedById: actorId,
  }
  if (existing) {
    await db.revenueEvent.update({where: {orderId}, data})
  } else {
    await db.revenueEvent.create({data: {orderId, ...data}})
  }
}

/** Apply an approved refund to the ledger (never deletes history). */
export async function applyRefundToLedger(orderId: string, amountUsd: number): Promise<void> {
  const event = await db.revenueEvent.findUnique({where: {orderId}})
  if (!event) return
  const refundUsd = round2(event.refundUsd + amountUsd)
  await db.revenueEvent.update({
    where: {orderId},
    data: {refundUsd, netUsd: round2(Math.max(0, event.grossUsd - event.processingUsd - refundUsd))},
  })
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

// ---------------------------------------------------------------------------
// Revenue Card — primary metrics (always visible)
// ---------------------------------------------------------------------------

export interface RevenueCardMetrics {
  periodLabel: string
  grossUsd: number
  grossKes: number
  netUsd: number
  processingUsd: number
  refundUsd: number
  cashCollectedUsd: number
  openOrderValueUsd: number
  openOrderCount: number
  aovUsd: number | null
  ordersCompleted: number
  revenueGrowthPct: number | null
  revenueGrowthUsd: number
  topSource: {dimension: string; label: string; valueUsd: number} | null
  series: {label: string; grossUsd: number; netUsd: number}[]
  feesConfigured: boolean
}

async function recognisedOrders(from: Date, to: Date) {
  const events = await db.revenueEvent.findMany({
    where: {recognisedAt: {gte: from, lt: to}},
    include: {order: {include: {payments: true}}},
  })
  return events
}

export async function revenueCardMetrics(period: Period): Promise<RevenueCardMetrics> {
  const [events, prevEvents, payments, openOrders] = await Promise.all([
    recognisedOrders(period.from, period.to),
    recognisedOrders(period.prevFrom, period.prevTo),
    db.payment.findMany({
      where: {status: 'verified', verifiedAt: {gte: period.from, lt: period.to}},
      select: {amountUsd: true},
    }),
    db.order.findMany({
      where: {status: {in: OPEN_ORDER_STATUSES}},
      select: {amountUsd: true},
    }),
  ])

  const grossUsd = round2(sum(events.map((e) => e.grossUsd)))
  const grossKes = round2(sum(events.map((e) => e.grossKes)))
  const processingUsd = round2(sum(events.map((e) => e.processingUsd)))
  const refundUsd = round2(sum(events.map((e) => e.refundUsd)))
  const netUsd = round2(sum(events.map((e) => e.netUsd)))
  const prevGross = round2(sum(prevEvents.map((e) => e.grossUsd)))
  const cashCollectedUsd = round2(sum(payments.map((p) => p.amountUsd)))
  const openOrderValueUsd = round2(sum(openOrders.map((o) => o.amountUsd)))

  // Daily (or weekly) series for the sparkline / trend chart.
  const dayMs = 86400000
  const spanDays = Math.max(1, Math.round((period.to.getTime() - period.from.getTime()) / dayMs))
  const step = spanDays > 92 ? 7 : 1
  const series: {label: string; grossUsd: number; netUsd: number}[] = []
  for (let t = period.from.getTime(); t < period.to.getTime(); t += step * dayMs) {
    const bFrom = new Date(t)
    const bTo = new Date(Math.min(t + step * dayMs, period.to.getTime()))
    const inBucket = events.filter((e) => e.recognisedAt >= bFrom && e.recognisedAt < bTo)
    series.push({
      label: bFrom.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}),
      grossUsd: round2(sum(inBucket.map((e) => e.grossUsd))),
      netUsd: round2(sum(inBucket.map((e) => e.netUsd))),
    })
  }

  // Top revenue source across brief type / source / investor segment.
  const breakdowns = await revenueBreakdowns(period)
  const candidates = [
    ...breakdowns.byBriefType.map((b) => ({dimension: 'Brief type', ...b})),
    ...breakdowns.bySource.map((b) => ({dimension: 'Opportunity source', ...b})),
    ...breakdowns.byInvestorType.map((b) => ({dimension: 'Investor type', ...b})),
  ]
  const topSource = candidates.length
    ? candidates.reduce((best, c) => (c.valueUsd > best.valueUsd ? c : best), candidates[0])
    : null

  return {
    periodLabel: period.label,
    grossUsd,
    grossKes,
    netUsd,
    processingUsd,
    refundUsd,
    cashCollectedUsd,
    openOrderValueUsd,
    openOrderCount: openOrders.length,
    aovUsd: events.length > 0 ? round2(grossUsd / events.length) : null,
    ordersCompleted: events.length,
    revenueGrowthPct: growth(grossUsd, prevGross),
    revenueGrowthUsd: round2(grossUsd - prevGross),
    topSource: topSource && topSource.valueUsd > 0 ? {dimension: topSource.dimension, label: topSource.label, valueUsd: topSource.valueUsd} : null,
    series,
    feesConfigured: await feeScheduleConfigured(),
  }
}

// ---------------------------------------------------------------------------
// Breakdown views
// ---------------------------------------------------------------------------

export interface BreakdownRow {
  label: string
  valueUsd: number
  count: number
}

interface EnrichedEvent {
  grossUsd: number
  briefType: string
  briefSource: string
  investorType: string
  country: string | null
  advisorId: string | null
}

async function enrichedEvents(period: Period): Promise<EnrichedEvent[]> {
  const events = await db.revenueEvent.findMany({
    where: {recognisedAt: {gte: period.from, lt: period.to}},
    include: {
      order: {
        select: {briefType: true, briefSource: true, userId: true, advisorId: true},
      },
    },
  })
  if (events.length === 0) return []

  // Resolve investor profile facts + advisor attribution for each order.
  const userIds = [...new Set(events.map((e) => e.order.userId))]
  const profiles = await db.investorProfile.findMany({
    where: {userId: {in: userIds}},
    select: {userId: true, classification: true, countryResidence: true, advisorId: true},
  })
  const byUser = new Map(profiles.map((p) => [p.userId, p]))

  const advisorIds = [
    ...new Set(events.map((e) => e.order.advisorId ?? byUser.get(e.order.userId)?.advisorId ?? null).filter((x): x is string => !!x)),
  ]
  const advisors = advisorIds.length
    ? await db.user.findMany({where: {id: {in: advisorIds}}, select: {id: true, fullName: true, email: true}})
    : []
  const advisorNames = new Map(advisors.map((a) => [a.id, a.fullName || a.email]))

  return events.map((e) => {
    const profile = byUser.get(e.order.userId)
    const advisorId = e.order.advisorId ?? profile?.advisorId ?? null
    return {
      grossUsd: e.grossUsd,
      briefType: e.order.briefType,
      briefSource: e.order.briefSource,
      investorType: profile?.classification ?? 'individual',
      country: profile?.countryResidence ?? null,
      advisorId: advisorId && advisorNames.has(advisorId) ? advisorId : advisorId,
    }
  })
}

export async function revenueBreakdowns(period: Period): Promise<{
  byBriefType: BreakdownRow[]
  bySource: BreakdownRow[]
  byInvestorType: BreakdownRow[]
  byGeography: BreakdownRow[]
  byAdvisor: BreakdownRow[]
  byAdvisorRaw: {advisorId: string; valueUsd: number; count: number}[]
  monthly: {label: string; grossUsd: number; netUsd: number}[]
}> {
  const events = await enrichedEvents(period)

  const group = (keyOf: (e: EnrichedEvent) => string): BreakdownRow[] => {
    const map = new Map<string, {valueUsd: number; count: number}>()
    for (const e of events) {
      const k = keyOf(e)
      const cur = map.get(k) ?? {valueUsd: 0, count: 0}
      cur.valueUsd = round2(cur.valueUsd + e.grossUsd)
      cur.count += 1
      map.set(k, cur)
    }
    return [...map.entries()]
      .map(([label, v]) => ({label, valueUsd: v.valueUsd, count: v.count}))
      .sort((a, b) => b.valueUsd - a.valueUsd)
  }

  // Monthly/quarterly recurring view over a wider window (trailing 12 months).
  const yearAgo = new Date(period.to.getTime() - 365 * 86400000)
  const monthlyEvents = await db.revenueEvent.findMany({
    where: {recognisedAt: {gte: yearAgo, lt: period.to}},
    select: {recognisedAt: true, grossUsd: true, netUsd: true},
  })
  const monthMap = new Map<string, {grossUsd: number; netUsd: number}>()
  for (const e of monthlyEvents) {
    const k = `${e.recognisedAt.getUTCFullYear()}-${String(e.recognisedAt.getUTCMonth() + 1).padStart(2, '0')}`
    const cur = monthMap.get(k) ?? {grossUsd: 0, netUsd: 0}
    cur.grossUsd = round2(cur.grossUsd + e.grossUsd)
    cur.netUsd = round2(cur.netUsd + e.netUsd)
    monthMap.set(k, cur)
  }
  const monthly = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({
      label: new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-GB', {month: 'short', year: '2-digit'}),
      ...v,
    }))

  const byAdvisorRaw = group((e) => e.advisorId ?? 'unattributed')
  // Resolve advisor names.
  const advisorIds = byAdvisorRaw.map((r) => r.label).filter((l) => l !== 'unattributed')
  const advisors = advisorIds.length
    ? await db.user.findMany({where: {id: {in: advisorIds}}, select: {id: true, fullName: true, email: true}})
    : []
  const nameOf = new Map(advisors.map((a) => [a.id, a.fullName || a.email]))
  const byAdvisor = byAdvisorRaw.map((r) => ({
    ...r,
    label: r.label === 'unattributed' ? 'Unattributed' : nameOf.get(r.label) ?? 'Unattributed',
  }))

  return {
    byBriefType: group((e) => e.briefType),
    bySource: group((e) => e.briefSource),
    byInvestorType: group((e) => e.investorType),
    byGeography: group((e) => e.country ?? 'Not stated'),
    byAdvisor,
    byAdvisorRaw,
    monthly,
  }
}

// ---------------------------------------------------------------------------
// Cohort revenue — investors acquired in period X, revenue ever recognised
// ---------------------------------------------------------------------------

export async function cohortRevenue(): Promise<{cohort: string; investors: number; revenueUsd: number; firstOrderToRevenueDays: number | null}[]> {
  const users = await db.user.findMany({
    where: {role: 'investor'},
    select: {id: true, createdAt: true},
  })
  const events = await db.revenueEvent.findMany({
    select: {grossUsd: true, recognisedAt: true, order: {select: {userId: true, createdAt: true}}},
  })

  const byUser = new Map<string, {cohort: string; revenue: number; recognised: Date[]}>()
  for (const u of users) {
    byUser.set(u.id, {
      cohort: `${u.createdAt.getUTCFullYear()}-${String(u.createdAt.getUTCMonth() + 1).padStart(2, '0')}`,
      revenue: 0,
      recognised: [],
    })
  }
  for (const e of events) {
    const entry = byUser.get(e.order.userId)
    if (!entry) continue
    entry.revenue = round2(entry.revenue + e.grossUsd)
    entry.recognised.push(e.recognisedAt)
  }

  const cohortMap = new Map<string, {investors: number; revenueUsd: number; lagDays: number[]}>()
  for (const [, v] of byUser) {
    const cur = cohortMap.get(v.cohort) ?? {investors: 0, revenueUsd: 0, lagDays: []}
    cur.investors += 1
    cur.revenueUsd = round2(cur.revenueUsd + v.revenue)
    cohortMap.set(v.cohort, cur)
  }
  // Time from registration to first recognised revenue, per cohort.
  for (const e of events) {
    const entry = byUser.get(e.order.userId)
    if (!entry || entry.recognised.length === 0) continue
    const first = entry.recognised.reduce((min, d) => (d < min ? d : min), entry.recognised[0])
    const cohort = cohortMap.get(entry.cohort)
    const user = users.find((u) => u.id === e.order.userId)
    if (cohort && user) cohort.lagDays.push((first.getTime() - user.createdAt.getTime()) / 86400000)
  }

  return [...cohortMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cohort, v]) => ({
      cohort,
      investors: v.investors,
      revenueUsd: v.revenueUsd,
      firstOrderToRevenueDays:
        v.lagDays.length > 0 ? Math.round((v.lagDays.reduce((a, b) => a + b, 0) / v.lagDays.length) * 10) / 10 : null,
    }))
}

// ---------------------------------------------------------------------------
// Pipeline revenue & forecast
// ---------------------------------------------------------------------------

export async function pipelineRevenue(): Promise<{
  weightedUsd: number
  mandateCount: number
  unweightedUsd: number
  expectedOpenOrdersUsd: number
  openOrderCount: number
  byStage: {stage: string; count: number; valueUsd: number}[]
  forecast: {conservativeUsd: number; baseUsd: number; upsideUsd: number; assumptions: string[]}
}> {
  const [mandates, openOrders] = await Promise.all([
    db.mandate.findMany({
      where: {status: 'active'},
      select: {targetAllocationMin: true, targetAllocationMax: true, probability: true, stage: true, currency: true},
    }),
    db.order.findMany({
      where: {status: {in: OPEN_ORDER_STATUSES}},
      select: {amountUsd: true},
    }),
  ])

  const midpoint = (m: {targetAllocationMin: number | null; targetAllocationMax: number | null; currency: string}) => {
    if (m.currency !== 'USD') return null // non-USD mandates excluded from the USD pipeline (labelled in UI)
    const lo = m.targetAllocationMin
    const hi = m.targetAllocationMax
    if (lo == null && hi == null) return null
    if (lo == null) return hi
    if (hi == null) return lo
    return (lo + hi) / 2
  }

  let weightedUsd = 0
  let unweightedUsd = 0
  const stageMap = new Map<string, {count: number; valueUsd: number}>()
  for (const m of mandates) {
    const mid = midpoint(m)
    if (mid == null) continue
    const prob = Math.min(100, Math.max(0, m.probability)) / 100
    weightedUsd += mid * prob
    unweightedUsd += mid
    const stage = m.stage ?? 'sourcing'
    const cur = stageMap.get(stage) ?? {count: 0, valueUsd: 0}
    cur.count += 1
    cur.valueUsd = round2(cur.valueUsd + mid)
    stageMap.set(stage, cur)
  }

  const expectedOpenOrdersUsd = round2(sum(openOrders.map((o) => o.amountUsd)))

  return {
    weightedUsd: round2(weightedUsd),
    mandateCount: mandates.length,
    unweightedUsd: round2(unweightedUsd),
    expectedOpenOrdersUsd,
    openOrderCount: openOrders.length,
    byStage: [...stageMap.entries()].map(([stage, v]) => ({stage, ...v})).sort((a, b) => b.valueUsd - a.valueUsd),
    forecast: {
      // Explicit, labelled conventions — no hidden assumptions.
      conservativeUsd: round2(weightedUsd * 0.6),
      baseUsd: round2(weightedUsd),
      upsideUsd: round2(weightedUsd * 1.2),
      assumptions: [
        'Conservative = 60% of weighted pipeline; Upside = 120% (fixed scenario conventions).',
        'Weighted pipeline = midpoint of target allocation × stated win probability, active USD mandates only.',
        'Expected open-order revenue = value of orders not yet delivered, independent of the mandate pipeline.',
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Unit economics
// ---------------------------------------------------------------------------

export async function unitEconomics(period: Period): Promise<{
  revenuePerActiveInvestorUsd: number | null
  revenuePerVerifiedInvestorUsd: number | null
  activeInvestors: number
  verifiedInvestors: number
  revenueUsd: number
  avgFulfilmentCostUsd: number | null
  contributionMarginPct: number | null
}> {
  const [events, activeCount, verifiedCount, costSetting] = await Promise.all([
    db.revenueEvent.findMany({where: {recognisedAt: {gte: period.from, lt: period.to}}, select: {grossUsd: true, processingUsd: true, refundUsd: true}}),
    db.user.count({where: {role: 'investor', status: 'active'}}),
    db.investorProfile.count({where: {verificationStatus: 'verified'}}),
    db.systemSetting.findUnique({where: {key: 'finance.avg_fulfilment_cost_usd'}}),
  ])

  const revenueUsd = round2(sum(events.map((e) => e.grossUsd)))
  const v = (costSetting?.value ?? {}) as Record<string, unknown>
  const avgCost = typeof v.amount === 'number' ? v.amount : null
  const orders = events.length

  return {
    revenuePerActiveInvestorUsd: activeCount > 0 ? round2(revenueUsd / activeCount) : null,
    revenuePerVerifiedInvestorUsd: verifiedCount > 0 ? round2(revenueUsd / verifiedCount) : null,
    activeInvestors: activeCount,
    verifiedInvestors: verifiedCount,
    revenueUsd,
    avgFulfilmentCostUsd: avgCost,
    contributionMarginPct:
      avgCost != null && orders > 0 && revenueUsd > 0
        ? round2(((revenueUsd - avgCost * orders) / revenueUsd) * 100)
        : null,
  }
}

/** Cash collected (verified payments) vs recognised revenue, per period — the
 *  reconciliation view Finance uses. */
export async function cashVersusRecognised(period: Period): Promise<{cashCollectedUsd: number; recognisedUsd: number; differenceUsd: number}> {
  const [payments, events] = await Promise.all([
    db.payment.findMany({where: {status: 'verified', verifiedAt: {gte: period.from, lt: period.to}}, select: {amountUsd: true}}),
    db.revenueEvent.findMany({where: {recognisedAt: {gte: period.from, lt: period.to}}, select: {grossUsd: true}}),
  ])
  const cash = round2(sum(payments.map((p) => p.amountUsd)))
  const recognised = round2(sum(events.map((e) => e.grossUsd)))
  return {cashCollectedUsd: cash, recognisedUsd: recognised, differenceUsd: round2(cash - recognised)}
}

export {inRange}
