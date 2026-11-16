import {supabase, unwrap, unwrapCount, toCamelList, nowIso} from '@/lib/supabase'
import {growth, inRange, avg, sum, type Period} from './period'
import type {
  ComparisonRow,
  ContentMetaRow,
  DocumentAccessLogRow,
  EnquiryRow,
  InvestorCriteriaRow,
  InvestorProfileRow,
  MandateRow,
  MessageRow,
  OpportunityViewRow,
  OrderRow,
  RevenueEventRow,
  SavedOpportunityRow,
  ScenarioRow,
  SessionRow,
  UserRow,
} from '@/lib/db-types'

/**
 * Comprehensive analytics layer for capital-allocation operations.
 * Every number is computed from real interaction tables — no sample data.
 * Views/saves reference Sanity content ids; titles are resolved separately
 * (see opportunityAnalytics) when Sanity is configured.
 */

// ---------------------------------------------------------------------------
// Executive dashboard (Command Centre + Analytics > Executive)
// ---------------------------------------------------------------------------

export async function executiveSnapshot(period: Period): Promise<{
  activeInvestors: {total: number; uhnwi: number; institutional: number; individual: number}
  newRegistrations: {current: number; previous: number; growthPct: number | null}
  verificationConversionPct: number | null
  activeMandates: number
  submittedMandates: number
  opportunities: {live: number; offMarket: number; auction: number; underOffer: number; closed: number; total: number; source: 'sanity' | 'meta' | 'none'}
  openOrders: {count: number; valueUsd: number}
  avgFulfilmentHours: number | null
  pipeline: {weightedUsd: number; unweightedUsd: number}
  revenueUsd: number
  aovUsd: number | null
}> {
  const [
    investorProfileRows,
    registrations,
    prevRegistrations,
    verifiedCount,
    activeMandates,
    submittedMandates,
    orderRows,
    revenueEventRows,
  ] = await Promise.all([
    unwrap<InvestorProfileRow[]>(await supabase.from('investor_profiles').select('*'), 'profiles.list'),
    unwrapCount(
      await supabase
        .from('users')
        .select('*', {count: 'exact', head: true})
        .eq('role', 'investor')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'users.count',
    ),
    unwrapCount(
      await supabase
        .from('users')
        .select('*', {count: 'exact', head: true})
        .eq('role', 'investor')
        .gte('created_at', period.prevFrom.toISOString())
        .lt('created_at', period.prevTo.toISOString()),
      'users.count',
    ),
    unwrapCount(
      await supabase.from('investor_profiles').select('*', {count: 'exact', head: true}).eq('verification_status', 'verified'),
      'profiles.count',
    ),
    unwrapCount(await supabase.from('mandates').select('*', {count: 'exact', head: true}).eq('status', 'active'), 'mandates.count'),
    unwrapCount(await supabase.from('mandates').select('*', {count: 'exact', head: true}).eq('status', 'submitted'), 'mandates.count'),
    unwrap<OrderRow[]>(await supabase.from('orders').select('*'), 'orders.list'),
    unwrap<RevenueEventRow[]>(
      await supabase
        .from('revenue_events')
        .select('*')
        .gte('recognised_at', period.from.toISOString())
        .lt('recognised_at', period.to.toISOString()),
      'revenue.list',
    ),
  ])
  const investorProfiles = toCamelList(investorProfileRows)
  const orders = toCamelList(orderRows)
  const revenueEvents = toCamelList(revenueEventRows)

  // Live users (status active) among profiled investors.
  const activeUserRows = unwrap<UserRow[]>(
    await supabase.from('users').select('*').eq('role', 'investor').eq('status', 'active'),
    'users.list',
  )
  const activeIds = new Set(activeUserRows.map((u) => u.id))
  const activeProfiles = investorProfiles.filter((p) => activeIds.has(p.userId))
  const byClass = (c: string) => activeProfiles.filter((p) => p.classification === c).length

  // Mandate pipeline value (weighted) — reuse the revenue module's logic inline.
  const activeMandateRows = toCamelList(
    unwrap<MandateRow[]>(
      await supabase.from('mandates').select('*').eq('status', 'active').eq('currency', 'USD'),
      'mandates.list',
    ),
  )
  const midpoint = (lo: number | null, hi: number | null) => (lo == null && hi == null ? null : lo == null ? hi : hi == null ? lo : (lo + hi) / 2)
  let weightedUsd = 0
  let unweightedUsd = 0
  for (const m of activeMandateRows) {
    const mid = midpoint(m.targetAllocationMin, m.targetAllocationMax)
    if (mid == null) continue
    weightedUsd += mid * (Math.min(100, Math.max(0, m.probability)) / 100)
    unweightedUsd += mid
  }

  // Opportunity inventory mix (from Sanity when configured, else DB signals).
  const {getAdminOpportunities} = await import('./queries')
  const sanityOps = await getAdminOpportunities()
  let oppMix = {live: 0, offMarket: 0, auction: 0, underOffer: 0, closed: 0, total: 0, source: 'none' as 'sanity' | 'meta' | 'none'}
  if (sanityOps.length > 0) {
    const closed = sanityOps.filter((o) => o.status === 'closed').length
    oppMix = {
      live: sanityOps.filter((o) => o.status !== 'closed').length,
      offMarket: sanityOps.filter((o) => o.status === 'off_market').length,
      auction: sanityOps.filter((o) => o.status === 'auction' || !!o.auctionUrl).length,
      underOffer: sanityOps.filter((o) => o.status === 'under_offer').length,
      closed,
      total: sanityOps.length,
      source: 'sanity',
    }
  } else {
    const metas = toCamelList(
      unwrap<ContentMetaRow[]>(
        await supabase.from('content_meta').select('*').eq('content_type', 'opportunity'),
        'contentMeta.list',
      ),
    )
    const tags = metas.flatMap((m) => (Array.isArray(m.tags) ? (m.tags as string[]) : []))
    oppMix = {
      live: metas.filter((m) => m.status === 'live').length,
      offMarket: tags.filter((t) => t === 'off_market').length,
      auction: tags.filter((t) => t === 'auction').length,
      underOffer: tags.filter((t) => t === 'under_offer').length,
      closed: metas.filter((m) => m.status === 'archived').length,
      total: metas.length,
      source: metas.length > 0 ? 'meta' : 'none',
    }
  }

  const open = orders.filter((o) => ['pending','awaiting_payment','payment_confirmed','processing','internal_review','ready'].includes(o.status))
  const deliveredInPeriod = orders.filter((o) => o.deliveredAt && inRange(new Date(o.deliveredAt), period.from, period.to))
  const fulfilmentHours = deliveredInPeriod
    .filter((o) => o.deliveredAt)
    .map((o) => (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 3600000)
  const revenueUsd = sum(revenueEvents.map((e) => e.grossUsd))

  const totalInvestors = investorProfiles.length
  return {
    activeInvestors: {
      total: activeProfiles.length,
      uhnwi: byClass('uhnwi'),
      institutional: byClass('institutional_rep'),
      individual: byClass('individual'),
    },
    newRegistrations: {current: registrations, previous: prevRegistrations, growthPct: growth(registrations, prevRegistrations)},
    verificationConversionPct: totalInvestors > 0 ? Math.round((verifiedCount / totalInvestors) * 1000) / 10 : null,
    activeMandates,
    submittedMandates,
    opportunities: oppMix,
    openOrders: {count: open.length, valueUsd: sum(open.map((o) => o.amountUsd))},
    avgFulfilmentHours: avg(fulfilmentHours),
    pipeline: {weightedUsd: Math.round(weightedUsd), unweightedUsd: Math.round(unweightedUsd)},
    revenueUsd,
    aovUsd: revenueEvents.length > 0 ? Math.round((revenueUsd / revenueEvents.length) * 100) / 100 : null,
  }
}

// ---------------------------------------------------------------------------
// Investor analytics
// ---------------------------------------------------------------------------

export async function investorAnalytics(period: Period): Promise<{
  sources: {label: string; count: number}[]
  funnel: {stage: string; count: number}[]
  engagement: {userId: string; name: string; classification: string; logins: number; saved: number; scenarios: number; comparisons: number; lastLoginAt: string | null}[]
  highValue: {userId: string; name: string; totalOrders: number; revenueUsd: number; classification: string}[]
  dormant: {userId: string; name: string; email: string; lastLoginAt: string | null; daysSinceLogin: number | null; tier: string}[]
  engagementTotals: {logins: number; saved: number; scenarios: number}
}> {
  const [profileRows, sessionRows, savedRows, scenarioRows, comparisonRows, userRows, revenueEventRows] = await Promise.all([
    unwrap<InvestorProfileRow[]>(await supabase.from('investor_profiles').select('*'), 'profiles.list'),
    unwrap<SessionRow[]>(
      await supabase
        .from('sessions')
        .select('*')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'sessions.list',
    ),
    unwrap<SavedOpportunityRow[]>(
      await supabase
        .from('saved_opportunities')
        .select('*')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'savedOpportunities.list',
    ),
    unwrap<ScenarioRow[]>(
      await supabase
        .from('scenarios')
        .select('*')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'scenarios.list',
    ),
    unwrap<ComparisonRow[]>(
      await supabase
        .from('comparisons')
        .select('*')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'comparisons.list',
    ),
    unwrap<UserRow[]>(await supabase.from('users').select('*').eq('role', 'investor'), 'users.list'),
    unwrap<RevenueEventRow[]>(await supabase.from('revenue_events').select('*'), 'revenue.list'),
  ])
  const profiles = toCamelList(profileRows)
  const sessions = toCamelList(sessionRows)
  const saves = toCamelList(savedRows)
  const scenarios = toCamelList(scenarioRows)
  const comparisons = toCamelList(comparisonRows)
  // Dates as Date objects (rows return ISO strings) for the period math below.
  const users = userRows.map((u) => ({
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    createdAt: new Date(u.created_at),
    emailVerifiedAt: u.email_verified_at ? new Date(u.email_verified_at) : null,
    lastLoginAt: u.last_login_at ? new Date(u.last_login_at) : null,
  }))
  // relation include (order) → separate query + JS join
  const eventOrderRows = revenueEventRows.length
    ? unwrap<OrderRow[]>(
        await supabase.from('orders').select('*').in('id', [...new Set(revenueEventRows.map((e) => e.order_id))]),
        'orders.list',
      )
    : []
  const eventOrderBy = new Map(eventOrderRows.map((o) => [o.id, o]))

  const byId = new Map(users.map((u) => [u.id, u]))
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]))

  // Acquisition sources
  const sourceMap = new Map<string, number>()
  for (const p of profiles) {
    const k = p.source?.trim() || 'Not stated'
    sourceMap.set(k, (sourceMap.get(k) ?? 0) + 1)
  }

  // Conversion funnel: Visit → Request Access → Verified → First Order / First Mandate
  const orderUsers = new Set(
    revenueEventRows.map((e) => eventOrderBy.get(e.order_id)?.user_id).filter((x): x is string => !!x),
  )
  const mandateRows = unwrap<MandateRow[]>(await supabase.from('mandates').select('*'), 'mandates.list')
  const mandateUsers = new Set(mandateRows.map((m) => m.user_id))
  const funnel = [
    {stage: 'Registered (visit → account)', count: users.length},
    {stage: 'Email verified', count: users.filter((u) => !!u.emailVerifiedAt).length},
    {stage: 'Profile submitted (access requested)', count: profiles.filter((p) => ['profile_submitted','kyc_pending','in_review','verified'].includes(p.verificationStatus)).length},
    {stage: 'Verified', count: profiles.filter((p) => p.verificationStatus === 'verified').length},
    {stage: 'First paid order', count: orderUsers.size},
    {stage: 'First mandate', count: mandateUsers.size},
  ]

  // Engagement per investor (period activity)
  const countBy = (rows: {userId: string}[]) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.userId, (m.get(r.userId) ?? 0) + 1)
    return m
  }
  const loginCounts = countBy(sessions)
  const saveCounts = countBy(saves)
  const scenarioCounts = countBy(scenarios)
  const comparisonCounts = countBy(comparisons)

  const engagement = profiles
    .map((p) => {
      const u = byId.get(p.userId)
      return {
        userId: p.userId,
        name: u?.fullName || u?.email || p.userId,
        classification: p.classification,
        logins: loginCounts.get(p.userId) ?? 0,
        saved: saveCounts.get(p.userId) ?? 0,
        scenarios: scenarioCounts.get(p.userId) ?? 0,
        comparisons: comparisonCounts.get(p.userId) ?? 0,
        lastLoginAt: u?.lastLoginAt?.toISOString() ?? null,
      }
    })
    .sort((a, b) => b.logins + b.saved + b.scenarios - (a.logins + a.saved + a.scenarios))
    .slice(0, 100)

  // High-value investors by recognised revenue
  const revenueByUser = new Map<string, {revenue: number; orders: number}>()
  for (const e of revenueEventRows) {
    const uid = eventOrderBy.get(e.order_id)?.user_id
    if (!uid) continue
    const cur = revenueByUser.get(uid) ?? {revenue: 0, orders: 0}
    cur.revenue += e.gross_usd
    cur.orders += 1
    revenueByUser.set(uid, cur)
  }
  const highValue = [...revenueByUser.entries()]
    .map(([userId, v]) => ({
      userId,
      name: byId.get(userId)?.fullName || byId.get(userId)?.email || userId,
      totalOrders: v.orders,
      revenueUsd: Math.round(v.revenue * 100) / 100,
      classification: profileByUser.get(userId)?.classification ?? 'individual',
    }))
    .sort((a, b) => b.revenueUsd - a.revenueUsd)
    .slice(0, 25)

  // Dormancy — verified investors with no login in 60+ days
  const now = Date.now()
  const dormant = profiles
    .filter((p) => ['verified','in_review','kyc_pending'].includes(p.verificationStatus))
    .map((p) => {
      const u = byId.get(p.userId)
      const days = u?.lastLoginAt ? Math.floor((now - u.lastLoginAt.getTime()) / 86400000) : null
      return {userId: p.userId, name: u?.fullName || u?.email || p.userId, email: u?.email ?? '', lastLoginAt: u?.lastLoginAt?.toISOString() ?? null, daysSinceLogin: days, tier: p.accessTier}
    })
    .filter((d) => d.daysSinceLogin == null || d.daysSinceLogin >= 60)
    .sort((a, b) => (b.daysSinceLogin ?? 9999) - (a.daysSinceLogin ?? 9999))
    .slice(0, 50)

  return {
    sources: [...sourceMap.entries()].map(([label, count]) => ({label, count})).sort((a, b) => b.count - a.count),
    funnel,
    engagement,
    highValue,
    dormant,
    engagementTotals: {logins: sessions.length, saved: saves.length, scenarios: scenarios.length + comparisons.length},
  }
}

// ---------------------------------------------------------------------------
// Opportunity analytics
// ---------------------------------------------------------------------------

export async function opportunityAnalytics(period: Period): Promise<{
  perOpportunity: {sanityId: string; title: string | null; views: number; uniqueViewers: number; saves: number; orders: number; revenueUsd: number}[]
  topViewed: {sanityId: string; title: string | null; views: number}[]
  highestConversion: {sanityId: string; title: string | null; views: number; orders: number; conversionPct: number | null}[]
  studioUsage: {scenarios: number; comparisons: number; capitalGapRuns: number}
  demandByAssetClass: {label: string; count: number}[]
  demandByGeography: {label: string; count: number}[]
}> {
  const [viewRows, savedRows, orderRows, revenueEventRows, scenarios, comparisons, criteriaRows] = await Promise.all([
    unwrap<OpportunityViewRow[]>(
      await supabase
        .from('opportunity_views')
        .select('*')
        .gte('viewed_at', period.from.toISOString())
        .lt('viewed_at', period.to.toISOString()),
      'opportunityViews.list',
    ),
    unwrap<SavedOpportunityRow[]>(
      await supabase
        .from('saved_opportunities')
        .select('*')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'savedOpportunities.list',
    ),
    unwrap<OrderRow[]>(
      await supabase.from('orders').select('*').not('sanity_opportunity_id', 'is', null),
      'orders.list',
    ),
    unwrap<RevenueEventRow[]>(await supabase.from('revenue_events').select('*'), 'revenue.list'),
    unwrapCount(
      await supabase
        .from('scenarios')
        .select('*', {count: 'exact', head: true})
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'scenarios.count',
    ),
    unwrapCount(
      await supabase
        .from('comparisons')
        .select('*', {count: 'exact', head: true})
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'comparisons.count',
    ),
    unwrap<InvestorCriteriaRow[]>(await supabase.from('investor_criteria').select('*'), 'criteria.list'),
  ])
  const views = toCamelList(viewRows)
  const saves = toCamelList(savedRows)
  const orders = toCamelList(orderRows)
  const criteria = toCamelList(criteriaRows)
  // relation include (order) → separate query + JS join
  const eventOrderRows = revenueEventRows.length
    ? unwrap<OrderRow[]>(
        await supabase.from('orders').select('*').in('id', [...new Set(revenueEventRows.map((e) => e.order_id))]),
        'orders.list',
      )
    : []
  const eventOrderBy = new Map(eventOrderRows.map((o) => [o.id, o]))

  const {getAdminOpportunities} = await import('./queries')
  const sanityOps = await getAdminOpportunities()
  const titles = new Map(sanityOps.map((o) => [o._id, o.title]))
  const metaRows = unwrap<ContentMetaRow[]>(
    await supabase.from('content_meta').select('*').eq('content_type', 'opportunity'),
    'contentMeta.list',
  )
  const metaTitles = new Map(metaRows.map((m) => [m.sanity_id, m.title]))
  const titleOf = (id: string) => titles.get(id) ?? metaTitles.get(id) ?? null

  const viewsBy = new Map<string, {views: number; viewers: Set<string>}>()
  for (const v of views) {
    const cur = viewsBy.get(v.sanityId) ?? {views: 0, viewers: new Set<string>()}
    cur.views += 1
    cur.viewers.add(v.userId)
    viewsBy.set(v.sanityId, cur)
  }
  const savesBy = new Map<string, number>()
  for (const s of saves) savesBy.set(s.sanityId, (savesBy.get(s.sanityId) ?? 0) + 1)
  const ordersBy = new Map<string, number>()
  for (const o of orders) {
    const id = o.sanityOpportunityId!
    ordersBy.set(id, (ordersBy.get(id) ?? 0) + 1)
  }
  const revenueBy = new Map<string, number>()
  for (const e of revenueEventRows) {
    const id = eventOrderBy.get(e.order_id)?.sanity_opportunity_id
    if (!id) continue
    revenueBy.set(id, (revenueBy.get(id) ?? 0) + e.gross_usd)
  }

  const allIds = new Set<string>([...viewsBy.keys(), ...savesBy.keys(), ...ordersBy.keys(), ...titles.keys()])
  const perOpportunity = [...allIds]
    .map((id) => ({
      sanityId: id,
      title: titleOf(id),
      views: viewsBy.get(id)?.views ?? 0,
      uniqueViewers: viewsBy.get(id)?.viewers.size ?? 0,
      saves: savesBy.get(id) ?? 0,
      orders: ordersBy.get(id) ?? 0,
      revenueUsd: Math.round((revenueBy.get(id) ?? 0) * 100) / 100,
    }))
    .sort((a, b) => b.views - a.views || b.orders - a.orders)

  const topViewed = perOpportunity.slice(0, 10).map((o) => ({sanityId: o.sanityId, title: o.title, views: o.views}))
  const highestConversion = perOpportunity
    .filter((o) => o.views >= 1 && o.orders > 0)
    .map((o) => ({sanityId: o.sanityId, title: o.title, views: o.views, orders: o.orders, conversionPct: Math.round((o.orders / o.views) * 1000) / 10}))
    .sort((a, b) => (b.conversionPct ?? 0) - (a.conversionPct ?? 0))
    .slice(0, 10)

  // Demand signals from stated investor criteria
  const assetMap = new Map<string, number>()
  for (const c of criteria) {
    for (const a of (c.assetClasses as string[] | null) ?? []) assetMap.set(a, (assetMap.get(a) ?? 0) + 1)
  }
  const geoMap = new Map<string, number>()
  for (const c of criteria) {
    for (const g of (c.geographies as {country?: string; city?: string}[] | null) ?? []) {
      const k = [g.country, g.city].filter(Boolean).join(' · ') || 'Not stated'
      geoMap.set(k, (geoMap.get(k) ?? 0) + 1)
    }
  }

  return {
    perOpportunity,
    topViewed,
    highestConversion,
    studioUsage: {
      scenarios,
      comparisons,
      // Capital-gap analysis is run inside the Investment Studio match view;
      // scenario creations are the observable proxy (labelled as such in UI).
      capitalGapRuns: scenarios,
    },
    demandByAssetClass: [...assetMap.entries()].map(([label, count]) => ({label, count})).sort((a, b) => b.count - a.count),
    demandByGeography: [...geoMap.entries()].map(([label, count]) => ({label, count})).sort((a, b) => b.count - a.count).slice(0, 12),
  }
}

// ---------------------------------------------------------------------------
// Orders & fulfilment analytics
// ---------------------------------------------------------------------------

export async function orderAnalytics(period: Period): Promise<{
  series: {label: string; count: number; valueUsd: number}[]
  statusCounts: {status: string; count: number; valueUsd: number}[]
  avgFulfilmentDays: number | null
  viewToOrderConversionPct: number | null
  viewsInPeriod: number
  ordersFromViews: number
  repeatOrderRatePct: number | null
  briefTypePerformance: {briefType: string; count: number; valueUsd: number; revenueUsd: number}[]
  avgOrderValueUsd: number | null
}> {
  const [orderRows, revenueEventRows, views] = await Promise.all([
    unwrap<OrderRow[]>(await supabase.from('orders').select('*'), 'orders.list'),
    unwrap<RevenueEventRow[]>(
      await supabase
        .from('revenue_events')
        .select('*')
        .gte('recognised_at', period.from.toISOString())
        .lt('recognised_at', period.to.toISOString()),
      'revenue.list',
    ),
    unwrapCount(
      await supabase
        .from('opportunity_views')
        .select('*', {count: 'exact', head: true})
        .gte('viewed_at', period.from.toISOString())
        .lt('viewed_at', period.to.toISOString()),
      'opportunityViews.count',
    ),
  ])
  const orders = toCamelList(orderRows)
  // relation include (order) → separate query + JS join
  const eventOrderRows = revenueEventRows.length
    ? unwrap<OrderRow[]>(
        await supabase.from('orders').select('*').in('id', [...new Set(revenueEventRows.map((e) => e.order_id))]),
        'orders.list',
      )
    : []
  const eventOrderBy = new Map(eventOrderRows.map((o) => [o.id, o]))

  const inPeriod = orders.filter((o) => inRange(new Date(o.createdAt), period.from, period.to))

  // Volume / value series
  const dayMs = 86400000
  const spanDays = Math.max(1, Math.round((period.to.getTime() - period.from.getTime()) / dayMs))
  const step = spanDays > 92 ? 7 : 1
  const series: {label: string; count: number; valueUsd: number}[] = []
  for (let t = period.from.getTime(); t < period.to.getTime(); t += step * dayMs) {
    const bFrom = new Date(t)
    const bTo = new Date(Math.min(t + step * dayMs, period.to.getTime()))
    const bucket = inPeriod.filter((o) => {
      const at = new Date(o.createdAt)
      return at >= bFrom && at < bTo
    })
    series.push({
      label: bFrom.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}),
      count: bucket.length,
      valueUsd: Math.round(sum(bucket.map((o) => o.amountUsd)) * 100) / 100,
    })
  }

  // Status distribution (all orders, current state)
  const statusMap = new Map<string, {count: number; valueUsd: number}>()
  for (const o of orders) {
    const cur = statusMap.get(o.status) ?? {count: 0, valueUsd: 0}
    cur.count += 1
    cur.valueUsd += o.amountUsd
    statusMap.set(o.status, cur)
  }

  // Fulfilment time for orders delivered in period
  const delivered = orders.filter((o) => o.deliveredAt && inRange(new Date(o.deliveredAt), period.from, period.to))
  const avgFulfilmentDays = avg(delivered.map((o) => (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 86400000))

  // Conversion from opportunity view → order (period)
  const ordersFromViews = inPeriod.filter((o) => !!o.sanityOpportunityId).length
  const viewToOrderConversionPct = views > 0 ? Math.round((ordersFromViews / views) * 1000) / 10 : null

  // Repeat order rate
  const byUser = new Map<string, number>()
  for (const o of orders) byUser.set(o.userId, (byUser.get(o.userId) ?? 0) + 1)
  const investorsWithOrders = byUser.size
  const repeat = [...byUser.values()].filter((n) => n >= 2).length
  const repeatOrderRatePct = investorsWithOrders > 0 ? Math.round((repeat / investorsWithOrders) * 1000) / 10 : null

  // Brief type performance
  const typeMap = new Map<string, {count: number; valueUsd: number; revenueUsd: number}>()
  for (const o of inPeriod) {
    const cur = typeMap.get(o.briefType) ?? {count: 0, valueUsd: 0, revenueUsd: 0}
    cur.count += 1
    cur.valueUsd += o.amountUsd
    typeMap.set(o.briefType, cur)
  }
  for (const e of revenueEventRows) {
    const cur = typeMap.get(eventOrderBy.get(e.order_id)?.brief_type ?? '')
    if (cur) cur.revenueUsd += e.gross_usd
  }

  return {
    series,
    statusCounts: [...statusMap.entries()].map(([status, v]) => ({status, ...v})),
    avgFulfilmentDays,
    viewToOrderConversionPct,
    viewsInPeriod: views,
    ordersFromViews,
    repeatOrderRatePct,
    briefTypePerformance: [...typeMap.entries()].map(([briefType, v]) => ({briefType, ...v})).sort((a, b) => b.valueUsd - a.valueUsd),
    avgOrderValueUsd: inPeriod.length > 0 ? Math.round((sum(inPeriod.map((o) => o.amountUsd)) / inPeriod.length) * 100) / 100 : null,
  }
}

// ---------------------------------------------------------------------------
// Mandate & pipeline analytics
// ---------------------------------------------------------------------------

export async function mandateAnalytics(period: Period): Promise<{
  volumeByStatus: {status: string; count: number}[]
  sizeDistribution: {bucket: string; count: number}[]
  winRatePct: number | null
  avgDaysToActivate: number | null
  avgDaysToClose: number | null
  byAdvisor: {advisorId: string | null; name: string; active: number; weightedUsd: number}[]
  stageDistribution: {stage: string; count: number; weightedUsd: number}[]
}> {
  const mandateRows = unwrap<MandateRow[]>(await supabase.from('mandates').select('*'), 'mandates.list')
  const mandates = toCamelList(mandateRows)

  const statusMap = new Map<string, number>()
  for (const m of mandates) statusMap.set(m.status, (statusMap.get(m.status) ?? 0) + 1)

  const midpoint = (m: typeof mandates[number]) => {
    if (m.currency !== 'USD') return null
    const lo = m.targetAllocationMin
    const hi = m.targetAllocationMax
    if (lo == null && hi == null) return null
    if (lo == null) return hi
    if (hi == null) return lo
    return (lo + hi) / 2
  }

  const buckets: [string, (v: number) => boolean][] = [
    ['< $1M', (v) => v < 1_000_000],
    ['$1M – $5M', (v) => v >= 1_000_000 && v < 5_000_000],
    ['$5M – $10M', (v) => v >= 5_000_000 && v < 10_000_000],
    ['$10M – $50M', (v) => v >= 10_000_000 && v < 50_000_000],
    ['$50M+', (v) => v >= 50_000_000],
  ]
  const sizeDistribution = buckets.map(([bucket, test]) => ({
    bucket,
    count: mandates.filter((m) => {
      const mid = midpoint(m)
      return mid != null && test(mid)
    }).length,
  }))

  const closed = mandates.filter((m) => m.status === 'closed').length
  const rejected = mandates.filter((m) => m.status === 'rejected').length
  const winRatePct = closed + rejected > 0 ? Math.round((closed / (closed + rejected)) * 1000) / 10 : null

  const activated = mandates.filter((m) => m.submittedAt && m.activatedAt)
  const avgDaysToActivate = avg(activated.map((m) => (new Date(m.activatedAt!).getTime() - new Date(m.submittedAt!).getTime()) / 86400000))
  const closedRows = mandates.filter((m) => m.activatedAt && m.closedAt)
  const avgDaysToClose = avg(closedRows.map((m) => (new Date(m.closedAt!).getTime() - new Date(m.activatedAt!).getTime()) / 86400000))

  // Advisor attribution
  const advisorIds = [...new Set(mandates.map((m) => m.advisorId).filter((x): x is string => !!x))]
  const advisorRows = advisorIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', advisorIds), 'users.list')
    : []
  const advisorNames = new Map(advisorRows.map((a) => [a.id, a.full_name || a.email]))
  const byAdvisorMap = new Map<string | null, {active: number; weighted: number}>()
  for (const m of mandates.filter((x) => x.status === 'active')) {
    const mid = midpoint(m)
    if (mid == null) continue
    const cur = byAdvisorMap.get(m.advisorId ?? null) ?? {active: 0, weighted: 0}
    cur.active += 1
    cur.weighted += mid * (Math.min(100, Math.max(0, m.probability)) / 100)
    byAdvisorMap.set(m.advisorId ?? null, cur)
  }
  const byAdvisor = [...byAdvisorMap.entries()]
    .map(([advisorId, v]) => ({advisorId, name: advisorId ? advisorNames.get(advisorId) ?? 'Advisor' : 'Unassigned', active: v.active, weightedUsd: Math.round(v.weighted)}))
    .sort((a, b) => b.weightedUsd - a.weightedUsd)

  const stageMap = new Map<string, {count: number; weighted: number}>()
  for (const m of mandates.filter((x) => x.status === 'active')) {
    const mid = midpoint(m)
    if (mid == null) continue
    const stage = m.stage ?? 'sourcing'
    const cur = stageMap.get(stage) ?? {count: 0, weighted: 0}
    cur.count += 1
    cur.weighted += mid * (Math.min(100, Math.max(0, m.probability)) / 100)
    stageMap.set(stage, cur)
  }

  return {
    volumeByStatus: [...statusMap.entries()].map(([status, count]) => ({status, count})),
    sizeDistribution,
    winRatePct,
    avgDaysToActivate,
    avgDaysToClose,
    byAdvisor,
    stageDistribution: [...stageMap.entries()].map(([stage, v]) => ({stage, count: v.count, weightedUsd: Math.round(v.weighted)})),
  }
}

// ---------------------------------------------------------------------------
// Operational health
// ---------------------------------------------------------------------------

export async function operationalHealth(period: Period): Promise<{
  avgFirstResponseHours: number | null
  openEnquiries: number
  docViews: number
  docDownloads: number
  topDocuments: {sanityDocumentId: string; title: string | null; views: number; downloads: number}[]
  sessionsPerDay: {label: string; count: number}[]
  activeSessions: number
  failedLogins: number
}> {
  const [enquiryRows, messageRows, accessLogRows, sessionRows, activeSessions, failedLogins] = await Promise.all([
    unwrap<EnquiryRow[]>(await supabase.from('enquiries').select('*'), 'enquiries.list'),
    unwrap<MessageRow[]>(await supabase.from('messages').select('*'), 'messages.list'),
    unwrap<DocumentAccessLogRow[]>(
      await supabase
        .from('document_access_logs')
        .select('*')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'docAccessLogs.list',
    ),
    unwrap<SessionRow[]>(
      await supabase
        .from('sessions')
        .select('*')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'sessions.list',
    ),
    unwrapCount(
      await supabase
        .from('sessions')
        .select('*', {count: 'exact', head: true})
        .is('revoked_at', null)
        .gt('expires_at', nowIso()),
      'sessions.countActive',
    ),
    unwrapCount(
      await supabase
        .from('security_events')
        .select('*', {count: 'exact', head: true})
        .eq('type', 'login_failed')
        .gte('created_at', period.from.toISOString())
        .lt('created_at', period.to.toISOString()),
      'securityEvents.count',
    ),
  ])
  const enquiries = toCamelList(enquiryRows)
  // First-response maths needs Date objects (rows return ISO strings).
  const messages = messageRows.map((m) => ({enquiryId: m.enquiry_id, senderType: m.sender_type, createdAt: new Date(m.created_at)}))
  const accessLogs = toCamelList(accessLogRows)
  const sessions = toCamelList(sessionRows)

  // First-response time: enquiry creation → first advisor/system reply
  const firstReplyByEnquiry = new Map<string, Date>()
  for (const m of messages) {
    if (m.senderType === 'investor' || !m.enquiryId) continue
    const cur = firstReplyByEnquiry.get(m.enquiryId)
    if (!cur || m.createdAt < cur) firstReplyByEnquiry.set(m.enquiryId, m.createdAt)
  }
  const responded = enquiries.filter((e) => firstReplyByEnquiry.has(e.id))
  const avgFirstResponseHours = avg(responded.map((e) => (firstReplyByEnquiry.get(e.id)!.getTime() - new Date(e.createdAt).getTime()) / 3600000))

  const docMap = new Map<string, {title: string | null; views: number; downloads: number}>()
  for (const l of accessLogs) {
    const cur = docMap.get(l.sanityDocumentId) ?? {title: l.documentTitle ?? null, views: 0, downloads: 0}
    if (l.action === 'view') cur.views += 1
    if (l.action === 'download') cur.downloads += 1
    if (!cur.title && l.documentTitle) cur.title = l.documentTitle
    docMap.set(l.sanityDocumentId, cur)
  }

  const dayMs = 86400000
  const sessionSeries: {label: string; count: number}[] = []
  for (let t = period.from.getTime(); t < period.to.getTime(); t += dayMs) {
    const bFrom = new Date(t)
    const bTo = new Date(t + dayMs)
    sessionSeries.push({
      label: bFrom.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}),
      count: sessions.filter((s) => {
        const at = new Date(s.createdAt)
        return at >= bFrom && at < bTo
      }).length,
    })
  }

  return {
    avgFirstResponseHours,
    openEnquiries: enquiries.filter((e) => e.status === 'open').length,
    docViews: accessLogs.filter((l) => l.action === 'view').length,
    docDownloads: accessLogs.filter((l) => l.action === 'download').length,
    topDocuments: [...docMap.entries()]
      .map(([sanityDocumentId, v]) => ({sanityDocumentId, title: v.title, views: v.views, downloads: v.downloads}))
      .sort((a, b) => b.views + b.downloads - (a.views + a.downloads))
      .slice(0, 10),
    sessionsPerDay: sessionSeries,
    activeSessions,
    failedLogins,
  }
}

// ---------------------------------------------------------------------------
// Advisor performance (Executive dashboard)
// ---------------------------------------------------------------------------

export async function advisorPerformance(period: Period): Promise<{advisorId: string; name: string; assignedInvestors: number; activeMandates: number; ordersSupported: number; revenueUsd: number}[]> {
  const [advisorRows, profileRows, mandateRows, revenueEventRows] = await Promise.all([
    unwrap<UserRow[]>(await supabase.from('users').select('*').in('role', ['advisor', 'admin']), 'users.list'),
    unwrap<InvestorProfileRow[]>(await supabase.from('investor_profiles').select('*'), 'profiles.list'),
    unwrap<MandateRow[]>(await supabase.from('mandates').select('*').eq('status', 'active'), 'mandates.list'),
    unwrap<RevenueEventRow[]>(await supabase.from('revenue_events').select('*'), 'revenue.list'),
  ])
  // relation include (order) → separate query + JS join
  const eventOrderRows = revenueEventRows.length
    ? unwrap<OrderRow[]>(
        await supabase.from('orders').select('*').in('id', [...new Set(revenueEventRows.map((e) => e.order_id))]),
        'orders.list',
      )
    : []
  const eventOrderBy = new Map(eventOrderRows.map((o) => [o.id, o]))

  const advisors = advisorRows.map((a) => ({id: a.id, fullName: a.full_name, email: a.email, role: a.role}))
  const profiles = profileRows.map((p) => ({userId: p.user_id, advisorId: p.advisor_id}))
  const mandates = mandateRows.map((m) => ({advisorId: m.advisor_id, userId: m.user_id}))

  const profileAdvisor = new Map(profiles.filter((p) => p.advisorId).map((p) => [p.userId, p.advisorId!]))
  const mandateAdvisor = new Map(mandates.filter((m) => m.advisorId).map((m) => [m.userId, m.advisorId!]))

  const rows = advisors.map((a) => {
    const id = a.id
    const assignedInvestors = profiles.filter((p) => p.advisorId === id).length
    const activeMandates = mandates.filter((m) => m.advisorId === id).length
    let ordersSupported = 0
    let revenueUsd = 0
    for (const e of revenueEventRows) {
      const orderRow = eventOrderBy.get(e.order_id)
      const attr = orderRow ? orderRow.advisor_id ?? profileAdvisor.get(orderRow.user_id) ?? mandateAdvisor.get(orderRow.user_id) : undefined
      if (attr === id) {
        ordersSupported += 1
        revenueUsd += e.gross_usd
      }
    }
    return {advisorId: id, name: a.fullName || a.email, assignedInvestors, activeMandates, ordersSupported, revenueUsd: Math.round(revenueUsd * 100) / 100}
  })

  return rows.filter((r) => r.assignedInvestors > 0 || r.activeMandates > 0 || r.ordersSupported > 0).sort((a, b) => b.revenueUsd - a.revenueUsd)
}
