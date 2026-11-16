import {supabase, unwrap, unwrapNullable, unwrapCount, toCamel, toCamelList, newId, nowIso} from '@/lib/supabase'
import {growth, inRange, sum, type Period} from './period'
import type {
  InvestorProfileRow,
  MandateRow,
  OrderRow,
  PaymentRow,
  RevenueEventRow,
  SystemSettingRow,
  UserRow,
} from '@/lib/db-types'

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
  const settingRow = unwrapNullable<SystemSettingRow>(
    await supabase.from('system_settings').select('*').eq('key', 'payments.fee_schedule').maybeSingle(),
    'settings.feeSchedule',
  )
  const v = (settingRow?.value ?? {}) as Record<string, unknown>
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
  const orderRow = unwrapNullable<OrderRow>(
    await supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
    'orders.get',
  )
  if (!orderRow || orderRow.status !== 'delivered') return
  const paymentRows = unwrap<PaymentRow[]>(
    await supabase.from('payments').select('*').eq('order_id', orderId),
    'payments.list',
  )
  const verified = paymentRows.filter((p) => p.status === 'verified')
  if (verified.length === 0) return

  const schedule = await getFeeSchedule()
  const grossUsd = orderRow.amount_usd
  const grossKes = orderRow.amount_kes
  const processingUsd = verified.reduce((acc, p) => {
    const pct = (schedule as unknown as Record<string, number>)[p.method] ?? 0
    return acc + (p.amount_usd * pct) / 100
  }, 0)

  const existingRow = unwrapNullable<RevenueEventRow>(
    await supabase.from('revenue_events').select('*').eq('order_id', orderId).maybeSingle(),
    'revenue.byOrder',
  )
  const refundUsd = existingRow?.refund_usd ?? 0
  const netUsd = Math.max(0, grossUsd - processingUsd - refundUsd)

  const payload = {
    gross_kes: grossKes,
    gross_usd: grossUsd,
    processing_usd: round2(processingUsd),
    refund_usd: refundUsd,
    net_usd: round2(netUsd),
    recognised_by_id: actorId,
  }
  if (existingRow) {
    unwrap<null>(await supabase.from('revenue_events').update(payload).eq('order_id', orderId), 'revenue.update')
  } else {
    // NOTE: sequential (no multi-table tx over PostgREST) — read-then-write upsert on order_id
    unwrap<null>(
      await supabase
        .from('revenue_events')
        .insert({id: newId(), order_id: orderId, recognised_at: nowIso(), ...payload}),
      'revenue.create',
    )
  }
}

/** Apply an approved refund to the ledger (never deletes history). */
export async function applyRefundToLedger(orderId: string, amountUsd: number): Promise<void> {
  const eventRow = unwrapNullable<RevenueEventRow>(
    await supabase.from('revenue_events').select('*').eq('order_id', orderId).maybeSingle(),
    'revenue.byOrder',
  )
  if (!eventRow) return
  const refundUsd = round2(eventRow.refund_usd + amountUsd)
  unwrap<null>(
    await supabase
      .from('revenue_events')
      .update({
        refund_usd: refundUsd,
        net_usd: round2(Math.max(0, eventRow.gross_usd - eventRow.processing_usd - refundUsd)),
      })
      .eq('order_id', orderId),
    'revenue.refund',
  )
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
  const eventRows = unwrap<RevenueEventRow[]>(
    await supabase
      .from('revenue_events')
      .select('*')
      .gte('recognised_at', from.toISOString())
      .lt('recognised_at', to.toISOString()),
    'revenue.list',
  )
  if (eventRows.length === 0) return []
  const orderIds = [...new Set(eventRows.map((e) => e.order_id))]
  // relation include (order + payments) → separate queries + JS join
  const orderRows = unwrap<OrderRow[]>(
    await supabase.from('orders').select('*').in('id', orderIds),
    'orders.list',
  )
  const paymentRows = unwrap<PaymentRow[]>(
    await supabase.from('payments').select('*').in('order_id', orderIds),
    'payments.list',
  )
  const orderBy = new Map(orderRows.map((o) => [o.id, o]))
  const paymentsBy = new Map<string, PaymentRow[]>()
  for (const p of paymentRows) {
    const arr = paymentsBy.get(p.order_id) ?? []
    arr.push(p)
    paymentsBy.set(p.order_id, arr)
  }
  return eventRows.map((e) => {
    const orderRow = orderBy.get(e.order_id)
    return {
      ...toCamel(e),
      order: orderRow ? {...toCamel(orderRow), payments: toCamelList(paymentsBy.get(orderRow.id) ?? [])} : null,
    }
  })
}

export async function revenueCardMetrics(period: Period): Promise<RevenueCardMetrics> {
  const [events, prevEvents, paymentRows, openOrderRows] = await Promise.all([
    recognisedOrders(period.from, period.to),
    recognisedOrders(period.prevFrom, period.prevTo),
    unwrap<PaymentRow[]>(
      await supabase
        .from('payments')
        .select('*')
        .eq('status', 'verified')
        .gte('verified_at', period.from.toISOString())
        .lt('verified_at', period.to.toISOString()),
      'payments.list',
    ),
    unwrap<OrderRow[]>(
      await supabase.from('orders').select('*').in('status', OPEN_ORDER_STATUSES),
      'orders.list',
    ),
  ])

  const grossUsd = round2(sum(events.map((e) => e.grossUsd)))
  const grossKes = round2(sum(events.map((e) => e.grossKes)))
  const processingUsd = round2(sum(events.map((e) => e.processingUsd)))
  const refundUsd = round2(sum(events.map((e) => e.refundUsd)))
  const netUsd = round2(sum(events.map((e) => e.netUsd)))
  const prevGross = round2(sum(prevEvents.map((e) => e.grossUsd)))
  const cashCollectedUsd = round2(sum(paymentRows.map((p) => p.amount_usd)))
  const openOrderValueUsd = round2(sum(openOrderRows.map((o) => o.amount_usd)))

  // Daily (or weekly) series for the sparkline / trend chart.
  const dayMs = 86400000
  const spanDays = Math.max(1, Math.round((period.to.getTime() - period.from.getTime()) / dayMs))
  const step = spanDays > 92 ? 7 : 1
  const series: {label: string; grossUsd: number; netUsd: number}[] = []
  for (let t = period.from.getTime(); t < period.to.getTime(); t += step * dayMs) {
    const bFrom = new Date(t)
    const bTo = new Date(Math.min(t + step * dayMs, period.to.getTime()))
    const inBucket = events.filter((e) => {
      const at = new Date(e.recognisedAt)
      return at >= bFrom && at < bTo
    })
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
    openOrderCount: openOrderRows.length,
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
  const eventRows = unwrap<RevenueEventRow[]>(
    await supabase
      .from('revenue_events')
      .select('*')
      .gte('recognised_at', period.from.toISOString())
      .lt('recognised_at', period.to.toISOString()),
    'revenue.list',
  )
  if (eventRows.length === 0) return []

  // relation include (order) → separate query + JS join
  const orderRows = unwrap<OrderRow[]>(
    await supabase.from('orders').select('*').in('id', [...new Set(eventRows.map((e) => e.order_id))]),
    'orders.list',
  )
  const orderBy = new Map(orderRows.map((o) => [o.id, o]))

  // Resolve investor profile facts + advisor attribution for each order.
  const userIds = [...new Set(orderRows.map((o) => o.user_id))]
  const profileRows = userIds.length
    ? unwrap<InvestorProfileRow[]>(
        await supabase.from('investor_profiles').select('*').in('user_id', userIds),
        'profiles.list',
      )
    : []
  const byUser = new Map(profileRows.map((p) => [p.user_id, p]))

  const advisorIds = [
    ...new Set(
      orderRows
        .map((o) => o.advisor_id ?? byUser.get(o.user_id)?.advisor_id ?? null)
        .filter((x): x is string => !!x),
    ),
  ]
  const advisorRows = advisorIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', advisorIds), 'users.list')
    : []
  const advisorNames = new Map(advisorRows.map((a) => [a.id, a.full_name || a.email]))

  return eventRows.map((e) => {
    const orderRow = orderBy.get(e.order_id)
    const profile = orderRow ? byUser.get(orderRow.user_id) : undefined
    const advisorId = orderRow ? orderRow.advisor_id ?? profile?.advisor_id ?? null : null
    return {
      grossUsd: e.gross_usd,
      briefType: orderRow?.brief_type ?? '',
      briefSource: orderRow?.brief_source ?? '',
      investorType: profile?.classification ?? 'individual',
      country: profile?.country_residence ?? null,
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
  const monthlyEventRows = unwrap<RevenueEventRow[]>(
    await supabase
      .from('revenue_events')
      .select('*')
      .gte('recognised_at', yearAgo.toISOString())
      .lt('recognised_at', period.to.toISOString()),
    'revenue.monthly',
  )
  const monthMap = new Map<string, {grossUsd: number; netUsd: number}>()
  for (const e of monthlyEventRows) {
    const d = new Date(e.recognised_at)
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const cur = monthMap.get(k) ?? {grossUsd: 0, netUsd: 0}
    cur.grossUsd = round2(cur.grossUsd + e.gross_usd)
    cur.netUsd = round2(cur.netUsd + e.net_usd)
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
  const advisorRows = advisorIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', advisorIds), 'users.list')
    : []
  const nameOf = new Map(advisorRows.map((a) => [a.id, a.full_name || a.email]))
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
  const userRows = unwrap<UserRow[]>(
    await supabase.from('users').select('*').eq('role', 'investor'),
    'users.list',
  )
  const eventRows = unwrap<RevenueEventRow[]>(
    await supabase.from('revenue_events').select('*'),
    'revenue.list',
  )
  // relation include (order) → separate query + JS join
  const orderRows = eventRows.length
    ? unwrap<OrderRow[]>(
        await supabase.from('orders').select('*').in('id', [...new Set(eventRows.map((e) => e.order_id))]),
        'orders.list',
      )
    : []
  const orderByUser = new Map(orderRows.map((o) => [o.id, o.user_id]))

  const users = userRows.map((u) => ({id: u.id, createdAt: new Date(u.created_at)}))

  const byUser = new Map<string, {cohort: string; revenue: number; recognised: Date[]}>()
  for (const u of users) {
    byUser.set(u.id, {
      cohort: `${u.createdAt.getUTCFullYear()}-${String(u.createdAt.getUTCMonth() + 1).padStart(2, '0')}`,
      revenue: 0,
      recognised: [],
    })
  }
  for (const e of eventRows) {
    const orderUserId = orderByUser.get(e.order_id)
    if (!orderUserId) continue
    const entry = byUser.get(orderUserId)
    if (!entry) continue
    entry.revenue = round2(entry.revenue + e.gross_usd)
    entry.recognised.push(new Date(e.recognised_at))
  }

  const cohortMap = new Map<string, {investors: number; revenueUsd: number; lagDays: number[]}>()
  for (const [, v] of byUser) {
    const cur = cohortMap.get(v.cohort) ?? {investors: 0, revenueUsd: 0, lagDays: []}
    cur.investors += 1
    cur.revenueUsd = round2(cur.revenueUsd + v.revenue)
    cohortMap.set(v.cohort, cur)
  }
  // Time from registration to first recognised revenue, per cohort.
  for (const e of eventRows) {
    const orderUserId = orderByUser.get(e.order_id)
    if (!orderUserId) continue
    const entry = byUser.get(orderUserId)
    if (!entry || entry.recognised.length === 0) continue
    const first = entry.recognised.reduce((min, d) => (d < min ? d : min), entry.recognised[0])
    const cohort = cohortMap.get(entry.cohort)
    const user = users.find((u) => u.id === orderUserId)
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
  const [mandateRows, openOrderRows] = await Promise.all([
    unwrap<MandateRow[]>(
      await supabase.from('mandates').select('*').eq('status', 'active'),
      'mandates.list',
    ),
    unwrap<OrderRow[]>(
      await supabase.from('orders').select('*').in('status', OPEN_ORDER_STATUSES),
      'orders.list',
    ),
  ])
  const mandates = toCamelList(mandateRows)
  const openOrders = toCamelList(openOrderRows)

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
  const [eventRes, activeRes, verifiedRes, costRes] = await Promise.all([
    supabase
      .from('revenue_events')
      .select('*')
      .gte('recognised_at', period.from.toISOString())
      .lt('recognised_at', period.to.toISOString()),
    supabase.from('users').select('*', {count: 'exact', head: true}).eq('role', 'investor').eq('status', 'active'),
    supabase.from('investor_profiles').select('*', {count: 'exact', head: true}).eq('verification_status', 'verified'),
    supabase.from('system_settings').select('*').eq('key', 'finance.avg_fulfilment_cost_usd').maybeSingle(),
  ])
  const events = unwrap<RevenueEventRow[]>(eventRes, 'revenue.list')
  const activeCount = unwrapCount(activeRes, 'users.count')
  const verifiedCount = unwrapCount(verifiedRes, 'profiles.count')
  const costSettingRow = unwrapNullable<SystemSettingRow>(costRes, 'settings.cost')

  const revenueUsd = round2(sum(events.map((e) => e.gross_usd)))
  const v = (costSettingRow?.value ?? {}) as Record<string, unknown>
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
  const [paymentRows, eventRows] = await Promise.all([
    unwrap<PaymentRow[]>(
      await supabase
        .from('payments')
        .select('*')
        .eq('status', 'verified')
        .gte('verified_at', period.from.toISOString())
        .lt('verified_at', period.to.toISOString()),
      'payments.list',
    ),
    unwrap<RevenueEventRow[]>(
      await supabase
        .from('revenue_events')
        .select('*')
        .gte('recognised_at', period.from.toISOString())
        .lt('recognised_at', period.to.toISOString()),
      'revenue.list',
    ),
  ])
  const cash = round2(sum(paymentRows.map((p) => p.amount_usd)))
  const recognised = round2(sum(eventRows.map((e) => e.gross_usd)))
  return {cashCollectedUsd: cash, recognisedUsd: recognised, differenceUsd: round2(cash - recognised)}
}

export {inRange}
