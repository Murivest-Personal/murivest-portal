import {cache} from 'react'
import {supabase, unwrap, unwrapNullable, unwrapCount, toCamel, toCamelList, auditTable} from '@/lib/supabase'
import {sanityClient} from '@/lib/sanity/client'
import type {OpportunityDoc, MarketReportDoc, AccessTier} from '@/lib/sanity/types'
import type {AdminContext} from './rbac'
import {investorScopeWhere} from './rbac'
import {revenueCardMetrics} from './revenue'
import type {Period} from './period'
import type {
  AuditLogRow,
  ComplianceReviewRow,
  ContentMetaRow,
  DocumentAccessLogRow,
  DocumentGrantRow,
  DocumentRequestRow,
  EnquiryRow,
  InternalNoteRow,
  InvestorCriteriaRow,
  InvestorProfileRow,
  MandateRow,
  MandateMilestoneRow,
  MessageRow,
  NdaAgreementRow,
  OpportunityViewRow,
  OrderRow,
  OrderStatusEventRow,
  OrganisationMemberRow,
  OrganisationRow,
  PaymentRow,
  RefundAdjustmentRow,
  RevenueEventRow,
  SavedOpportunityRow,
  SecurityEventRow,
  SessionRow,
  StaffProfileRow,
  SystemSettingRow,
  UserRow,
} from '@/lib/db-types'

/**
 * Admin read-model — one function per module screen. Advisor scoping is
 * applied inside every query: advisors only ever receive rows belonging to
 * investors assigned to them.
 */

// ---------------------------------------------------------------------------
// Sanity admin reads (all tiers — staff perspective)
// ---------------------------------------------------------------------------

const ADMIN_OPP_PROJECTION = `{
  _id, title, "slug": slug.current, status, accessTier, assetClass, geography,
  dealStructure, indicativePrice, investmentSizeMin, investmentSizeMax,
  financials, summary, auctionUrl, featured, publishDate, kycBuyerForm
}`

export const getAdminOpportunities = cache(async (): Promise<OpportunityDoc[]> => {
  const client = sanityClient()
  if (!client) return []
  return client.fetch(
    `*[_type == "opportunity" && defined(published) && published == true] | order(publishDate desc, title asc) ${ADMIN_OPP_PROJECTION}`,
  )
})

export const getAdminOpportunityById = cache(async (id: string): Promise<OpportunityDoc | null> => {
  const client = sanityClient()
  if (!client) return null
  return client.fetch(
    `*[_type == "opportunity" && _id == $id][0] ${ADMIN_OPP_PROJECTION}`,
    {id},
  )
})

export const getAdminReports = cache(async (): Promise<MarketReportDoc[]> => {
  const client = sanityClient()
  if (!client) return []
  return client.fetch(
    `*[_type == "marketReport" && defined(published) && published == true] | order(publishDate desc) {_id, title, "slug": slug.current, category, geography, accessTier, summary, publishDate}`,
  )
})

export function sanityStudioUrl(): string {
  return process.env.SANITY_STUDIO_URL || 'https://murivest.sanity.studio'
}

// ---------------------------------------------------------------------------
// Investors
// ---------------------------------------------------------------------------

export interface InvestorListRow {
  userId: string
  email: string
  fullName: string | null
  status: string
  classification: string
  verificationStatus: string
  kycStatus: string
  amlStatus: string
  accessTier: string
  ndaAccepted: boolean
  advisorId: string | null
  source: string | null
  countryResidence: string | null
  organisationId: string | null
  organisationName: string | null
  equityAvailable: number | null
  totalCapacity: number | null
  capitalFloor: number | null
  capitalCeiling: number | null
  capitalCurrency: string
  createdAt: Date
  lastLoginAt: Date | null
  orderCount: number
  revenueUsd: number
  activeMandates: number
}

export async function investorList(
  actx: AdminContext,
  opts: {search?: string; tier?: string; verification?: string; classification?: string; dormant?: boolean; limit?: number} = {},
): Promise<InvestorListRow[]> {
  const scope = investorScopeWhere(actx)
  const search = opts.search?.trim().toLowerCase() || null

  let profileQuery = supabase.from('investor_profiles').select('*')
  if (scope) profileQuery = profileQuery.eq('advisor_id', scope.advisorId)
  if (opts.tier) profileQuery = profileQuery.eq('access_tier', opts.tier)
  if (opts.verification) profileQuery = profileQuery.eq('verification_status', opts.verification)
  if (opts.classification) profileQuery = profileQuery.eq('classification', opts.classification)
  const profileRows = unwrap<InvestorProfileRow[]>(
    await profileQuery.order('created_at', {ascending: false}).limit(opts.limit ?? 500),
    'profiles.list',
  )

  // relation include → separate query + JS join
  const profileUserIds = profileRows.map((p) => p.user_id)
  const userRows = profileUserIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', profileUserIds), 'users.list')
    : []
  const userBy = new Map(userRows.map((u) => [u.id, u]))

  let rows = profileRows.filter((p) => {
    if (!search) return true
    const u = userBy.get(p.user_id)
    return (
      (u?.email ?? '').toLowerCase().includes(search) ||
      (u?.full_name ?? '').toLowerCase().includes(search) ||
      (p.country_residence ?? '').toLowerCase().includes(search)
    )
  })

  if (opts.dormant) {
    const cutoff = Date.now() - 60 * 86400000
    rows = rows.filter((p) => {
      const lastLogin = userBy.get(p.user_id)?.last_login_at
      return !lastLogin || new Date(lastLogin).getTime() < cutoff
    })
  }

  const userIds = rows.map((r) => r.user_id)
  const [orderRows, revenueEventRows, mandateRows, orgRows] = await Promise.all([
    userIds.length ? unwrap<OrderRow[]>(await supabase.from('orders').select('*').in('user_id', userIds), 'orders.list') : [],
    userIds.length ? unwrap<RevenueEventRow[]>(await supabase.from('revenue_events').select('*'), 'revenue.list') : [],
    userIds.length ? unwrap<MandateRow[]>(await supabase.from('mandates').select('*').in('user_id', userIds).eq('status', 'active'), 'mandates.list') : [],
    unwrap<OrganisationRow[]>(await supabase.from('organisations').select('*'), 'organisations.list'),
  ])
  // revenue-event → order join: separate query + JS map
  const revenueOrderRows = revenueEventRows.length
    ? unwrap<OrderRow[]>(
        await supabase.from('orders').select('*').in('id', [...new Set(revenueEventRows.map((e) => e.order_id))]),
        'orders.list',
      )
    : []
  const revenueOrderUser = new Map(revenueOrderRows.map((o) => [o.id, o.user_id]))

  const orderCount = new Map<string, number>()
  for (const o of orderRows) orderCount.set(o.user_id, (orderCount.get(o.user_id) ?? 0) + 1)
  const revenueBy = new Map<string, number>()
  for (const e of revenueEventRows) {
    const uid = revenueOrderUser.get(e.order_id)
    if (!uid) continue
    revenueBy.set(uid, (revenueBy.get(uid) ?? 0) + e.gross_usd)
  }
  const mandateCount = new Map<string, number>()
  for (const m of mandateRows) mandateCount.set(m.user_id, (mandateCount.get(m.user_id) ?? 0) + 1)
  const orgNames = new Map(orgRows.map((o) => [o.id, o.name]))

  return rows.map((p) => {
    const u = userBy.get(p.user_id)
    return {
      userId: p.user_id,
      email: u?.email ?? '',
      fullName: u?.full_name ?? null,
      status: u?.status ?? '',
      classification: p.classification,
      verificationStatus: p.verification_status,
      kycStatus: p.kyc_status,
      amlStatus: p.aml_status,
      accessTier: p.access_tier,
      ndaAccepted: p.nda_accepted,
      advisorId: p.advisor_id,
      source: p.source,
      countryResidence: p.country_residence,
      organisationId: p.organisation_id,
      organisationName: p.organisation_id ? orgNames.get(p.organisation_id) ?? null : null,
      equityAvailable: p.equity_available,
      totalCapacity: p.total_capacity,
      capitalFloor: p.capital_floor,
      capitalCeiling: p.capital_ceiling,
      capitalCurrency: p.capital_currency,
      createdAt: new Date(u?.created_at ?? Date.now()),
      lastLoginAt: u?.last_login_at ? new Date(u.last_login_at) : null,
      orderCount: orderCount.get(p.user_id) ?? 0,
      revenueUsd: Math.round((revenueBy.get(p.user_id) ?? 0) * 100) / 100,
      activeMandates: mandateCount.get(p.user_id) ?? 0,
    }
  })
}

/** Organisation + members + member users (separate queries + JS join). */
async function organisationWithMembers(organisationId: string) {
  const orgRow = unwrapNullable<OrganisationRow>(
    await supabase.from('organisations').select('*').eq('id', organisationId).maybeSingle(),
    'organisations.get',
  )
  if (!orgRow) return null
  const memberRows = unwrap<OrganisationMemberRow[]>(
    await supabase.from('organisation_members').select('*').eq('organisation_id', organisationId),
    'organisationMembers.list',
  )
  const memberUserIds = memberRows.map((m) => m.user_id)
  const memberUserRows = memberUserIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', memberUserIds), 'users.list')
    : []
  const memberUserBy = new Map(memberUserRows.map((u) => [u.id, u]))
  return {
    ...toCamel(orgRow),
    members: memberRows.map((m) => {
      const u = memberUserBy.get(m.user_id)
      return {
        ...toCamel(m),
        user: u ? {id: u.id, fullName: u.full_name, email: u.email} : {id: m.user_id, fullName: null, email: ''},
      }
    }),
  }
}

export async function investorDetail(actx: AdminContext, userId: string) {
  const scope = investorScopeWhere(actx)
  const profileRow = unwrapNullable<InvestorProfileRow>(
    await supabase.from('investor_profiles').select('*').eq('user_id', userId).maybeSingle(),
    'profiles.byUser',
  )
  if (!profileRow) return null
  if (scope && profileRow.advisor_id !== actx.auth.user.id) return null
  const profile = toCamel(profileRow)
  const userLookup = unwrapNullable<UserRow>(
    await supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    'users.get',
  )
  if (!userLookup) return null // FK guarantees the user; defensive null for typed consumers

  const [org, orderRows, mandateRows, grantRows, sessionRows, secEventRows, noteRows, reviewRows, criteriaRow, savedCount, scenarioCount, enquiriesCount, auditRows, advisorRow] = await Promise.all([
    profile.organisationId ? organisationWithMembers(profile.organisationId) : null,
    unwrap<OrderRow[]>(await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', {ascending: false}), 'orders.list'),
    unwrap<MandateRow[]>(await supabase.from('mandates').select('*').eq('user_id', userId).order('created_at', {ascending: false}), 'mandates.list'),
    unwrap<DocumentGrantRow[]>(await supabase.from('document_grants').select('*').eq('user_id', userId).order('created_at', {ascending: false}), 'documentGrants.list'),
    unwrap<SessionRow[]>(await supabase.from('sessions').select('*').eq('user_id', userId).order('last_seen_at', {ascending: false}).limit(6), 'sessions.list'),
    unwrap<SecurityEventRow[]>(await supabase.from('security_events').select('*').eq('user_id', userId).order('created_at', {ascending: false}).limit(12), 'securityEvents.list'),
    unwrap<InternalNoteRow[]>(await supabase.from('internal_notes').select('*').eq('entity_type', 'investor').eq('entity_id', userId).order('created_at', {ascending: false}), 'internalNotes.list'),
    unwrap<ComplianceReviewRow[]>(await supabase.from('compliance_reviews').select('*').eq('subject_user_id', userId).order('created_at', {ascending: false}).limit(20), 'complianceReviews.list'),
    unwrapNullable<InvestorCriteriaRow>(await supabase.from('investor_criteria').select('*').eq('user_id', userId).maybeSingle(), 'criteria.byUser'),
    unwrapCount(await supabase.from('saved_opportunities').select('*', {count: 'exact', head: true}).eq('user_id', userId), 'savedOpportunities.count'),
    unwrapCount(await supabase.from('scenarios').select('*', {count: 'exact', head: true}).eq('user_id', userId), 'scenarios.count'),
    unwrapCount(await supabase.from('enquiries').select('*', {count: 'exact', head: true}).eq('user_id', userId), 'enquiries.count'),
    unwrap<AuditLogRow[]>(
      await auditTable()
        .select('*')
        .or(`actor_id.eq."${userId}",(entity.eq."profile" and entity_id.eq."${profile.id}")`)
        .order('created_at', {ascending: false})
        .limit(40),
      'audit.investorTrail',
    ),
    profile.advisorId
      ? unwrapNullable<UserRow>(await supabase.from('users').select('*').eq('id', profile.advisorId).maybeSingle(), 'users.get')
      : null,
  ])

  const staffIds = [...new Set([...noteRows.map((n) => n.author_id), ...reviewRows.map((r) => r.reviewer_id)].filter((x): x is string => !!x))]
  const staffRows = staffIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', staffIds), 'users.list') : []
  const staffNames = new Map(staffRows.map((s) => [s.id, s.full_name || s.email]))

  return {
    profile,
    user: {
      id: userLookup.id,
      email: userLookup.email,
      fullName: userLookup.full_name,
      status: userLookup.status,
      lastLoginAt: userLookup.last_login_at,
      createdAt: userLookup.created_at,
      emailVerifiedAt: userLookup.email_verified_at,
      mfaEnabled: userLookup.mfa_enabled,
      failedLogins: userLookup.failed_logins,
      lockedUntil: userLookup.locked_until,
    },
    organisation: org,
    advisor: advisorRow ? {id: advisorRow.id, fullName: advisorRow.full_name, email: advisorRow.email} : null,
    orders: orderRows.map((o) => ({
      id: o.id,
      reference: o.reference,
      briefTitle: o.brief_title,
      briefType: o.brief_type,
      status: o.status,
      amountUsd: o.amount_usd,
      currency: o.currency,
      createdAt: o.created_at,
      deliveredAt: o.delivered_at,
    })),
    mandates: mandateRows.map((m) => ({
      id: m.id,
      reference: m.reference,
      title: m.title,
      status: m.status,
      stage: m.stage,
      probability: m.probability,
      targetAllocationMin: m.target_allocation_min,
      targetAllocationMax: m.target_allocation_max,
      currency: m.currency,
      createdAt: m.created_at,
    })),
    grants: grantRows.map((g) => ({
      id: g.id,
      sanityDocumentId: g.sanity_document_id,
      permission: g.permission,
      expiresAt: g.expires_at,
      createdAt: g.created_at,
    })),
    sessions: sessionRows.map((s) => ({
      id: s.id,
      device: s.device,
      ip: s.ip,
      userAgent: s.user_agent,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      expiresAt: s.expires_at,
      revokedAt: s.revoked_at,
    })),
    securityEvents: secEventRows.map((e) => ({id: e.id, type: e.type, ip: e.ip, createdAt: e.created_at})),
    notes: noteRows.map((n) => ({
      id: n.id,
      authorId: n.author_id,
      body: n.body,
      visibility: n.visibility,
      createdAt: n.created_at,
      authorName: staffNames.get(n.author_id) ?? 'Staff',
    })),
    reviews: reviewRows.map((r) => ({
      id: r.id,
      reviewerId: r.reviewer_id,
      decision: r.decision,
      notes: r.notes,
      riskFlags: r.risk_flags,
      detail: r.detail,
      createdAt: r.created_at,
      reviewerName: staffNames.get(r.reviewer_id) ?? 'Staff',
    })),
    criteria: criteriaRow ? toCamel(criteriaRow) : null,
    stats: {savedCount, scenarioCount, enquiriesCount},
    auditTrail: auditRows.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entity_id,
      actorType: l.actor_type,
      detail: l.detail,
      ip: l.ip,
      createdAt: l.created_at,
    })),
  }
}

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

export async function organisationList() {
  const orgRows = unwrap<OrganisationRow[]>(
    await supabase.from('organisations').select('*').order('created_at', {ascending: false}),
    'organisations.list',
  )
  // nested relation include (members + users) → separate queries + JS join
  const orgIds = orgRows.map((o) => o.id)
  const memberRows = orgIds.length
    ? unwrap<OrganisationMemberRow[]>(
        await supabase.from('organisation_members').select('*').in('organisation_id', orgIds),
        'organisationMembers.list',
      )
    : []
  const memberUserIds = [...new Set(memberRows.map((m) => m.user_id))]
  const memberUserRows = memberUserIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', memberUserIds), 'users.list')
    : []
  const memberUserBy = new Map(memberUserRows.map((u) => [u.id, u]))
  const membersByOrg = new Map<string, OrganisationMemberRow[]>()
  for (const m of memberRows) {
    const arr = membersByOrg.get(m.organisation_id) ?? []
    arr.push(m)
    membersByOrg.set(m.organisation_id, arr)
  }
  return orgRows.map((o) => ({
    id: o.id,
    name: o.name,
    legalName: o.legal_name,
    type: o.type,
    country: o.country,
    website: o.website,
    verified: o.verified,
    createdAt: o.created_at,
    members: (membersByOrg.get(o.id) ?? []).map((m) => {
      const u = memberUserBy.get(m.user_id)
      return {
        id: m.id,
        userId: m.user_id,
        name: u?.full_name || u?.email || m.user_id,
        email: u?.email ?? '',
        role: m.role,
        title: m.title,
        status: m.status,
        lastLoginAt: u?.last_login_at ?? null,
      }
    }),
  }))
}

// ---------------------------------------------------------------------------
// Orders (Orders Engine)
// ---------------------------------------------------------------------------

const OPEN_STATUSES = ['pending', 'awaiting_payment', 'payment_confirmed', 'processing', 'internal_review', 'ready']

function paymentView(p: PaymentRow) {
  return {
    id: p.id,
    status: p.status,
    method: p.method,
    amountUsd: p.amount_usd,
    amountKes: p.amount_kes,
    reference: p.reference,
    createdAt: p.created_at,
    verifiedAt: p.verified_at,
  }
}

export async function orderList(
  actx: AdminContext,
  opts: {status?: string; search?: string; priority?: string; assignedTo?: string; limit?: number} = {},
) {
  const assignedUserIds = actx.advisorId
    ? unwrap<InvestorProfileRow[]>(
        await supabase.from('investor_profiles').select('*').eq('advisor_id', actx.auth.user.id),
        'profiles.list',
      ).map((p) => p.user_id)
    : null

  let orderQuery = supabase.from('orders').select('*')
  if (opts.status === 'open') orderQuery = orderQuery.in('status', OPEN_STATUSES)
  else if (opts.status) orderQuery = orderQuery.eq('status', opts.status)
  if (opts.priority) orderQuery = orderQuery.eq('priority', opts.priority)
  if (opts.assignedTo === 'me') orderQuery = orderQuery.eq('assigned_to_id', actx.auth.user.id)
  else if (opts.assignedTo === 'unassigned') orderQuery = orderQuery.is('assigned_to_id', null)
  if (assignedUserIds) orderQuery = orderQuery.in('user_id', assignedUserIds)
  const orderRows = unwrap<OrderRow[]>(
    await orderQuery.order('created_at', {ascending: false}).limit(opts.limit ?? 400),
    'orders.list',
  )

  const search = opts.search?.trim().toLowerCase()
  let orders = orderRows.filter((o) => {
    if (!search) return true
    return (
      o.reference.toLowerCase().includes(search) ||
      (o.brief_title ?? '').toLowerCase().includes(search) ||
      (o.contact_email ?? '').toLowerCase().includes(search) ||
      (o.contact_name ?? '').toLowerCase().includes(search)
    )
  })

  // relation include (payments) → separate query + JS join
  const orderIds = orders.map((o) => o.id)
  const paymentRows = orderIds.length
    ? unwrap<PaymentRow[]>(
        await supabase.from('payments').select('*').in('order_id', orderIds).order('created_at', {ascending: true}),
        'payments.list',
      )
    : []
  const paymentsBy = new Map<string, PaymentRow[]>()
  for (const p of paymentRows) {
    const arr = paymentsBy.get(p.order_id) ?? []
    arr.push(p)
    paymentsBy.set(p.order_id, arr)
  }

  const userIds = [...new Set(orders.map((o) => o.user_id))]
  const profileRows = userIds.length
    ? unwrap<InvestorProfileRow[]>(await supabase.from('investor_profiles').select('*').in('user_id', userIds), 'profiles.list')
    : []
  const userRows = userIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', userIds), 'users.list') : []
  const orgIds = [...new Set(profileRows.map((p) => p.organisation_id).filter((x): x is string => !!x))]
  const orgRows = orgIds.length ? unwrap<OrganisationRow[]>(await supabase.from('organisations').select('*').in('id', orgIds), 'organisations.list') : []
  const profileBy = new Map(profileRows.map((p) => [p.user_id, p]))
  const userBy = new Map(userRows.map((u) => [u.id, u]))
  const orgBy = new Map(orgRows.map((o) => [o.id, o.name]))

  return orders.map((o) => {
    const profile = profileBy.get(o.user_id)
    const orderPayments = paymentsBy.get(o.id) ?? []
    return {
      id: o.id,
      reference: o.reference,
      userId: o.user_id,
      investorName: userBy.get(o.user_id)?.full_name || userBy.get(o.user_id)?.email || o.user_id,
      investorEmail: userBy.get(o.user_id)?.email ?? '',
      investorClass: profile?.classification ?? 'individual',
      investorTier: profile?.access_tier ?? 'tier_1',
      organisationName: profile?.organisation_id ? orgBy.get(profile.organisation_id) ?? null : null,
      briefTitle: o.brief_title,
      briefType: o.brief_type,
      briefSource: o.brief_source,
      format: o.format,
      customScope: o.custom_scope,
      status: o.status,
      priority: o.priority,
      assignedToId: o.assigned_to_id,
      advisorId: o.advisor_id ?? profile?.advisor_id ?? null,
      amountUsd: o.amount_usd,
      amountKes: o.amount_kes,
      currency: o.currency,
      createdAt: o.created_at,
      dueAt: o.due_at,
      deliveredAt: o.delivered_at,
      closedAt: o.closed_at,
      payment: orderPayments[0] ? paymentView(orderPayments[0]) : null,
      hasVerifiedPayment: orderPayments.some((p) => p.status === 'verified'),
    }
  })
}

export async function orderDetail(actx: AdminContext, orderId: string) {
  const orderRow = unwrapNullable<OrderRow>(
    await supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
    'orders.get',
  )
  if (!orderRow) return null
  const order = toCamel(orderRow)
  // relation include (payments) → separate query + JS join
  const paymentRows = unwrap<PaymentRow[]>(
    await supabase.from('payments').select('*').eq('order_id', orderId).order('created_at', {ascending: true}),
    'payments.list',
  )
  const payments = toCamelList(paymentRows)

  const [profileRow, userRow, eventRows, noteRows, refundRows, revenueRow] = await Promise.all([
    unwrapNullable<InvestorProfileRow>(
      await supabase.from('investor_profiles').select('*').eq('user_id', orderRow.user_id).maybeSingle(),
      'profiles.byUser',
    ),
    unwrapNullable<UserRow>(await supabase.from('users').select('*').eq('id', orderRow.user_id).maybeSingle(), 'users.get'),
    unwrap<OrderStatusEventRow[]>(
      await supabase.from('order_status_events').select('*').eq('order_id', orderId).order('created_at', {ascending: true}),
      'orderStatusEvents.list',
    ),
    unwrap<InternalNoteRow[]>(
      await supabase.from('internal_notes').select('*').eq('entity_type', 'order').eq('entity_id', orderId).order('created_at', {ascending: false}),
      'internalNotes.list',
    ),
    unwrap<RefundAdjustmentRow[]>(
      await supabase.from('refund_adjustments').select('*').eq('order_id', orderId).order('created_at', {ascending: false}),
      'refundAdjustments.list',
    ),
    unwrapNullable<RevenueEventRow>(
      await supabase.from('revenue_events').select('*').eq('order_id', orderId).maybeSingle(),
      'revenue.byOrder',
    ),
  ])
  const profile = profileRow ? toCamel(profileRow) : null

  if (actx.advisorId && profile?.advisorId !== actx.auth.user.id) return null

  const staffIds = [
    ...new Set(
      [
        ...eventRows.map((e) => e.changed_by_id),
        ...noteRows.map((n) => n.author_id),
        ...refundRows.map((r) => r.requested_by_id),
        ...refundRows.map((r) => r.reviewed_by_id ?? null),
        orderRow.assigned_to_id,
        orderRow.advisor_id,
        profileRow?.advisor_id ?? null,
      ].filter((x): x is string => !!x),
    ),
  ]
  const staffRows = staffIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', staffIds), 'users.list') : []
  const staffNames = new Map(staffRows.map((s) => [s.id, s.full_name || s.email]))

  return {
    order,
    investor: {
      user: userRow ? {id: userRow.id, fullName: userRow.full_name, email: userRow.email, status: userRow.status} : null,
      profile,
    },
    payments,
    events: eventRows.map((e) => ({
      ...toCamel(e),
      changedByName: e.changed_by_id ? staffNames.get(e.changed_by_id) ?? 'Staff' : 'System',
    })),
    notes: noteRows.map((n) => ({
      ...toCamel(n),
      authorName: staffNames.get(n.author_id) ?? 'Staff',
    })),
    refunds: refundRows.map((r) => ({
      ...toCamel(r),
      requestedByName: staffNames.get(r.requested_by_id) ?? 'Staff',
      reviewedByName: r.reviewed_by_id ? staffNames.get(r.reviewed_by_id) ?? 'Staff' : null,
    })),
    revenue: revenueRow ? toCamel(revenueRow) : null,
    assignment: {
      assignedToName: orderRow.assigned_to_id ? staffNames.get(orderRow.assigned_to_id) ?? null : null,
      advisorName: (orderRow.advisor_id ?? profileRow?.advisor_id ?? null)
        ? staffNames.get(orderRow.advisor_id ?? profileRow!.advisor_id!) ?? null
        : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Mandates & pipeline
// ---------------------------------------------------------------------------

/**
 * Advisor scope — OR(userId IN assigned, advisorId = actor) → two queries
 * merged + deduped + re-sorted in JS (no multi-table tx over PostgREST).
 */
async function mandatesByAdvisorScope(
  advisorUserId: string,
  assignedUserIds: string[],
  opts: {status?: string; stage?: string; ascending: boolean; limit: number},
): Promise<MandateRow[]> {
  const mkQuery = () => {
    let q = supabase.from('mandates').select('*')
    if (opts.status) q = q.eq('status', opts.status)
    if (opts.stage) q = q.eq('stage', opts.stage)
    return q
  }
  const [byUsers, byAdvisor] = await Promise.all([
    unwrap<MandateRow[]>(
      await mkQuery().in('user_id', assignedUserIds).order('updated_at', {ascending: opts.ascending}).limit(opts.limit),
      'mandates.list',
    ),
    unwrap<MandateRow[]>(
      await mkQuery().eq('advisor_id', advisorUserId).order('updated_at', {ascending: opts.ascending}).limit(opts.limit),
      'mandates.list',
    ),
  ])
  const merged: MandateRow[] = []
  const seen = new Set<string>()
  for (const m of [...byUsers, ...byAdvisor]) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    merged.push(m)
  }
  merged.sort((a, b) => {
    if (a.updated_at === b.updated_at) return 0
    return (a.updated_at < b.updated_at) === opts.ascending ? -1 : 1
  })
  return merged.slice(0, opts.limit)
}

export async function mandateList(
  actx: AdminContext,
  opts: {status?: string; stage?: string; search?: string; limit?: number} = {},
) {
  const assignedUserIds = actx.advisorId
    ? unwrap<InvestorProfileRow[]>(
        await supabase.from('investor_profiles').select('*').eq('advisor_id', actx.auth.user.id),
        'profiles.list',
      ).map((p) => p.user_id)
    : null

  let mandateRows: MandateRow[]
  if (assignedUserIds) {
    mandateRows = await mandatesByAdvisorScope(actx.auth.user.id, assignedUserIds, {
      status: opts.status,
      stage: opts.stage,
      ascending: false,
      limit: opts.limit ?? 300,
    })
  } else {
    let mandateQuery = supabase.from('mandates').select('*')
    if (opts.status) mandateQuery = mandateQuery.eq('status', opts.status)
    if (opts.stage) mandateQuery = mandateQuery.eq('stage', opts.stage)
    mandateRows = unwrap<MandateRow[]>(
      await mandateQuery.order('updated_at', {ascending: false}).limit(opts.limit ?? 300),
      'mandates.list',
    )
  }
  let mandates = toCamelList(mandateRows)

  const search = opts.search?.trim().toLowerCase()
  if (search) mandates = mandates.filter((m) => m.reference.toLowerCase().includes(search) || m.title.toLowerCase().includes(search))

  // relation include (milestones) → separate query + JS join
  const mandateIds = mandates.map((m) => m.id)
  const milestoneRows = mandateIds.length
    ? unwrap<MandateMilestoneRow[]>(
        await supabase.from('mandate_milestones').select('*').in('mandate_id', mandateIds).order('created_at', {ascending: true}),
        'mandateMilestones.list',
      )
    : []
  const milestonesBy = new Map<string, MandateMilestoneRow[]>()
  for (const ms of milestoneRows) {
    const arr = milestonesBy.get(ms.mandate_id) ?? []
    arr.push(ms)
    milestonesBy.set(ms.mandate_id, arr)
  }

  const userIds = [...new Set(mandates.map((m) => m.userId))]
  const userRows = userIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', userIds), 'users.list') : []
  const userBy = new Map(userRows.map((u) => [u.id, u]))
  const advisorRows = unwrap<UserRow[]>(await supabase.from('users').select('*').in('role', ['advisor', 'admin']), 'users.list')
  const advisorNames = new Map(advisorRows.map((a) => [a.id, a.full_name || a.email]))

  return mandates.map((m) => ({
    id: m.id,
    reference: m.reference,
    title: m.title,
    status: m.status,
    stage: m.stage,
    probability: m.probability,
    nextAction: m.nextAction,
    nextActionDue: m.nextActionDue,
    targetAllocationMin: m.targetAllocationMin,
    targetAllocationMax: m.targetAllocationMax,
    currency: m.currency,
    geographies: m.geographies,
    assetClasses: m.assetClasses,
    minNetYield: m.minNetYield,
    targetIrr: m.targetIrr,
    investorName: userBy.get(m.userId)?.full_name || userBy.get(m.userId)?.email || m.userId,
    investorEmail: userBy.get(m.userId)?.email ?? '',
    advisorId: m.advisorId,
    advisorName: m.advisorId ? advisorNames.get(m.advisorId) ?? null : null,
    milestones: (milestonesBy.get(m.id) ?? []).map((ms) => ({id: ms.id, title: ms.title, status: ms.status, dueDate: ms.due_date})),
    createdAt: m.createdAt,
    submittedAt: m.submittedAt,
    activatedAt: m.activatedAt,
    closedAt: m.closedAt,
    updatedAt: m.updatedAt,
  }))
}

// ---------------------------------------------------------------------------
// Documents & data room
// ---------------------------------------------------------------------------

export async function documentsWorkspace() {
  const [grantRows, requestRows, accessLogRows, metaRows] = await Promise.all([
    unwrap<DocumentGrantRow[]>(
      await supabase.from('document_grants').select('*').order('created_at', {ascending: false}).limit(400),
      'documentGrants.list',
    ),
    unwrap<DocumentRequestRow[]>(
      await supabase.from('document_requests').select('*').order('created_at', {ascending: false}).limit(200),
      'documentRequests.list',
    ),
    unwrap<DocumentAccessLogRow[]>(
      await supabase.from('document_access_logs').select('*').order('created_at', {ascending: false}).limit(300),
      'docAccessLogs.list',
    ),
    unwrap<ContentMetaRow[]>(await supabase.from('content_meta').select('*').eq('content_type', 'document'), 'contentMeta.list'),
  ])

  const userIds = [...new Set([...grantRows.map((g) => g.user_id ?? ''), ...accessLogRows.map((l) => l.user_id), ...requestRows.map((r) => r.user_id)].filter(Boolean))]
  const userRows = userIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', userIds), 'users.list') : []
  const userBy = new Map(userRows.map((u) => [u.id, u.full_name || u.email]))

  // Sanity document titles (server-side, all tiers)
  const client = sanityClient()
  const sanityDocs = client
    ? await client.fetch(`*[_type == "document" && defined(published) && published == true] | order(title asc) {_id, title, docType, accessTier, downloadable, publishDate, "fileExtension": file.asset->extension}`).catch(() => [])
    : []
  const briefDocs = client
    ? await client.fetch(`*[_type == "brief" && defined(digitalDocument)] | order(title asc) {_id, title, "docType": "report", accessTier, "downloadable": true, "publishDate": _updatedAt, "fileExtension": digitalDocument->extension}`).catch(() => [])
    : []

  return {
    grants: grantRows.map((g) => ({
      id: g.id,
      sanityDocumentId: g.sanity_document_id,
      userId: g.user_id,
      organisationId: g.organisation_id,
      permission: g.permission,
      expiresAt: g.expires_at,
      grantedById: g.granted_by_id,
      createdAt: g.created_at,
      userName: g.user_id ? userBy.get(g.user_id) ?? g.user_id : null,
    })),
    requests: toCamelList(requestRows).map((r) => ({...r, userName: userBy.get(r.userId) ?? r.userId})),
    accessLogs: accessLogRows.map((l) => ({
      id: l.id,
      userId: l.user_id,
      sanityDocumentId: l.sanity_document_id,
      documentTitle: l.document_title,
      action: l.action,
      ip: l.ip,
      createdAt: l.created_at,
      userName: userBy.get(l.user_id) ?? l.user_id,
    })),
    metas: metaRows.map((m) => ({
      sanityId: m.sanity_id,
      status: m.status,
      visibilityTier: m.visibility_tier,
      tags: m.tags,
      notes: m.notes,
    })),
    sanityDocs: [...sanityDocs, ...briefDocs],
    sanityConfigured: !!client,
  }
}

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------

export async function communicationsData(actx: AdminContext, opts: {status?: string} = {}) {
  const assignedUserIds = actx.advisorId
    ? unwrap<InvestorProfileRow[]>(
        await supabase.from('investor_profiles').select('*').eq('advisor_id', actx.auth.user.id),
        'profiles.list',
      ).map((p) => p.user_id)
    : null

  let enquiryQuery = supabase.from('enquiries').select('*')
  if (opts.status) enquiryQuery = enquiryQuery.eq('status', opts.status)
  if (assignedUserIds) enquiryQuery = enquiryQuery.in('user_id', assignedUserIds)
  const enquiryRows = unwrap<EnquiryRow[]>(
    await enquiryQuery.order('created_at', {ascending: false}).limit(200),
    'enquiries.list',
  )
  // relation include (messages) → separate query + JS join
  const enquiryIds = enquiryRows.map((e) => e.id)
  const messageRows = enquiryIds.length
    ? unwrap<MessageRow[]>(
        await supabase.from('messages').select('*').in('enquiry_id', enquiryIds).order('created_at', {ascending: true}),
        'messages.list',
      )
    : []
  const messagesBy = new Map<string, MessageRow[]>()
  for (const m of messageRows) {
    const arr = messagesBy.get(m.enquiry_id) ?? []
    arr.push(m)
    messagesBy.set(m.enquiry_id, arr)
  }

  const userIds = [...new Set(enquiryRows.map((e) => e.user_id))]
  const userRows = userIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', userIds), 'users.list') : []
  const profileRows = userIds.length
    ? unwrap<InvestorProfileRow[]>(await supabase.from('investor_profiles').select('*').in('user_id', userIds), 'profiles.list')
    : []
  const userBy = new Map(userRows.map((u) => [u.id, u]))
  const profileBy = new Map(profileRows.map((p) => [p.user_id, p]))
  const advisorRows = unwrap<UserRow[]>(await supabase.from('users').select('*').in('role', ['advisor', 'admin']), 'users.list')
  const advisorNames = new Map(advisorRows.map((a) => [a.id, a.full_name || a.email]))

  const threads = enquiryRows.map((e) => {
    const messages = toCamelList(messagesBy.get(e.id) ?? [])
    const lastAdvisorMsg = [...messages].reverse().find((m) => m.senderType !== 'investor')
    const profile = profileBy.get(e.user_id)
    return {
      id: e.id,
      userId: e.user_id,
      investorName: userBy.get(e.user_id)?.full_name || userBy.get(e.user_id)?.email || e.user_id,
      investorEmail: userBy.get(e.user_id)?.email ?? '',
      investorClass: profile?.classification ?? 'individual',
      tier: profile?.access_tier ?? 'tier_1',
      assignedAdvisor: profile?.advisor_id ?? null,
      assignedAdvisorName: profile?.advisor_id ? advisorNames.get(profile.advisor_id) ?? null : null,
      subject: e.subject,
      opportunityTitle: e.opportunity_title,
      status: e.status,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      messages: messages.map((m) => ({id: m.id, senderType: m.senderType, senderId: m.senderId, senderName: m.senderId ? advisorNames.get(m.senderId) ?? null : null, body: m.body, createdAt: m.createdAt, readAt: m.readAt})),
      awaitingReply: !lastAdvisorMsg,
      lastActivityAt: messages.length > 0 ? messages[messages.length - 1].createdAt : e.created_at,
    }
  })

  const noteRows = unwrap<InternalNoteRow[]>(
    await supabase.from('internal_notes').select('*').eq('entity_type', 'enquiry').order('created_at', {ascending: false}).limit(100),
    'internalNotes.list',
  )
  const notes = toCamelList(noteRows)

  return {threads, notes}
}

// ---------------------------------------------------------------------------
// Compliance workspace
// ---------------------------------------------------------------------------

export async function complianceQueue() {
  const [pendingRows, ndaGapRows, docRequestRows, flaggedAmlRows, suspendedUserRows, reviewRows, ndaRows] = await Promise.all([
    unwrap<InvestorProfileRow[]>(
      await supabase
        .from('investor_profiles')
        .select('*')
        .or('verification_status.in.("kyc_pending","in_review","profile_submitted"),kyc_status.in.("submitted","in_review")')
        .order('updated_at', {ascending: false}),
      'profiles.list',
    ),
    unwrap<InvestorProfileRow[]>(
      await supabase.from('investor_profiles').select('*').in('access_tier', ['tier_2', 'tier_3']).eq('nda_accepted', false),
      'profiles.list',
    ),
    unwrap<DocumentRequestRow[]>(
      await supabase.from('document_requests').select('*').in('status', ['submitted', 'in_review']).order('created_at', {ascending: true}),
      'documentRequests.list',
    ),
    unwrap<InvestorProfileRow[]>(await supabase.from('investor_profiles').select('*').eq('aml_status', 'flagged'), 'profiles.list'),
    unwrap<UserRow[]>(await supabase.from('users').select('*').in('status', ['suspended', 'locked']), 'users.list'),
    unwrap<ComplianceReviewRow[]>(
      await supabase.from('compliance_reviews').select('*').order('created_at', {ascending: false}).limit(50),
      'complianceReviews.list',
    ),
    unwrap<NdaAgreementRow[]>(
      await supabase.from('nda_agreements').select('*').order('created_at', {ascending: false}).limit(100),
      'ndaAgreements.list',
    ),
  ])
  // OR(aml flagged, user suspended/locked) → two queries + JS union
  const suspendedProfileRows = suspendedUserRows.length
    ? unwrap<InvestorProfileRow[]>(
        await supabase.from('investor_profiles').select('*').in('user_id', suspendedUserRows.map((u) => u.id)),
        'profiles.list',
      )
    : []
  const flaggedBy = new Map<string, InvestorProfileRow>()
  for (const p of [...flaggedAmlRows, ...suspendedProfileRows]) flaggedBy.set(p.user_id, p)

  // relation include → separate query + JS join
  const involvedUserIds = [...new Set([...pendingRows, ...ndaGapRows, ...flaggedBy.values()].map((p) => p.user_id))]
  const userRows = involvedUserIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', involvedUserIds), 'users.list')
    : []
  const userBy = new Map(userRows.map((u) => [u.id, u]))

  const staffIds = [...new Set(reviewRows.map((r) => r.reviewer_id).filter((x): x is string => !!x))]
  const staffRows = staffIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', staffIds), 'users.list') : []
  const staffNames = new Map(staffRows.map((s) => [s.id, s.full_name || s.email]))
  const requestUserIds = [...new Set(docRequestRows.map((r) => r.user_id))]
  const requestUserRows = requestUserIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', requestUserIds), 'users.list') : []
  const requestUserBy = new Map(requestUserRows.map((u) => [u.id, u.full_name || u.email]))

  const flaggedRows = [...flaggedBy.values()]

  return {
    pending: pendingRows.map((p) => {
      const u = userBy.get(p.user_id)
      return {
        userId: p.user_id,
        profileId: p.id,
        email: u?.email ?? '',
        fullName: u?.full_name ?? null,
        accountStatus: u?.status ?? '',
        classification: p.classification,
        verificationStatus: p.verification_status,
        kycStatus: p.kyc_status,
        amlStatus: p.aml_status,
        accessTier: p.access_tier,
        ndaAccepted: p.nda_accepted,
        nationality: p.nationality,
        countryResidence: p.country_residence,
        advisorId: p.advisor_id,
        createdAt: u?.created_at ?? p.created_at,
        updatedAt: p.updated_at,
      }
    }),
    ndaGaps: ndaGapRows.map((p) => {
      const u = userBy.get(p.user_id)
      return {userId: p.user_id, email: u?.email ?? '', fullName: u?.full_name ?? null, accessTier: p.access_tier}
    }),
    docRequests: toCamelList(docRequestRows).map((r) => ({...r, userName: requestUserBy.get(r.userId) ?? r.userId})),
    flagged: flaggedRows.map((p) => {
      const u = userBy.get(p.user_id)
      return {userId: p.user_id, email: u?.email ?? '', fullName: u?.full_name ?? null, accountStatus: u?.status ?? '', amlStatus: p.aml_status, accessTier: p.access_tier}
    }),
    reviews: toCamelList(reviewRows).map((r) => ({...r, reviewerName: staffNames.get(r.reviewerId) ?? 'Staff'})),
    ndaVersions: ndaRows.map((n) => ({id: n.id, userId: n.user_id, version: n.version, ip: n.ip, createdAt: n.created_at})),
  }
}

// ---------------------------------------------------------------------------
// Opportunity inventory (Sanity + interaction analytics + governance meta)
// ---------------------------------------------------------------------------

export async function opportunityInventory() {
  const [sanityOps, metaRows, viewRows, savedRows, orderRows, revenueEventRows] = await Promise.all([
    getAdminOpportunities(),
    unwrap<ContentMetaRow[]>(await supabase.from('content_meta').select('*').eq('content_type', 'opportunity'), 'contentMeta.list'),
    unwrap<OpportunityViewRow[]>(await supabase.from('opportunity_views').select('*'), 'opportunityViews.list'),
    unwrap<SavedOpportunityRow[]>(await supabase.from('saved_opportunities').select('*'), 'savedOpportunities.list'),
    unwrap<OrderRow[]>(await supabase.from('orders').select('*').not('sanity_opportunity_id', 'is', null), 'orders.list'),
    unwrap<RevenueEventRow[]>(await supabase.from('revenue_events').select('*'), 'revenue.list'),
  ])
  // revenue-event → order join: separate query + JS map
  const revenueOrderRows = revenueEventRows.length
    ? unwrap<OrderRow[]>(
        await supabase.from('orders').select('*').in('id', [...new Set(revenueEventRows.map((e) => e.order_id))]),
        'orders.list',
      )
    : []
  const revenueOrderById = new Map(revenueOrderRows.map((o) => [o.id, o]))

  const viewsBy = new Map<string, {views: number; viewers: Set<string>}>()
  for (const v of viewRows) {
    const cur = viewsBy.get(v.sanity_id) ?? {views: 0, viewers: new Set<string>()}
    cur.views += 1
    cur.viewers.add(v.user_id)
    viewsBy.set(v.sanity_id, cur)
  }
  const savesBy = new Map<string, number>()
  for (const s of savedRows) savesBy.set(s.sanity_id, (savesBy.get(s.sanity_id) ?? 0) + 1)
  const ordersBy = new Map<string, number>()
  for (const o of orderRows) ordersBy.set(o.sanity_opportunity_id!, (ordersBy.get(o.sanity_opportunity_id!) ?? 0) + 1)
  const revenueBy = new Map<string, number>()
  for (const e of revenueEventRows) {
    const oppId = revenueOrderById.get(e.order_id)?.sanity_opportunity_id
    if (!oppId) continue
    revenueBy.set(oppId, (revenueBy.get(oppId) ?? 0) + e.gross_usd)
  }
  const metaBy = new Map(toCamelList(metaRows).map((m) => [m.sanityId, m]))

  // Include Sanity documents AND any DB-tracked ids missing from Sanity.
  const ids = new Set<string>([...sanityOps.map((o) => o._id), ...viewsBy.keys(), ...ordersBy.keys(), ...toCamelList(metaRows).map((m) => m.sanityId)])
  const sanityById = new Map(sanityOps.map((o) => [o._id, o]))

  const rows = [...ids].map((id) => {
    const op = sanityById.get(id)
    const meta = metaBy.get(id)
    const analytics = viewsBy.get(id)
    return {
      sanityId: id,
      title: op?.title ?? meta?.title ?? id,
      status: op?.status ?? (meta?.status === 'archived' ? 'closed' : 'marketed'),
      accessTier: (op?.accessTier ?? 'tier_1') as AccessTier,
      assetClass: op?.assetClass ?? null,
      geography: op?.geography ?? null,
      indicativePrice: op?.indicativePrice ?? null,
      investmentSizeMin: op?.investmentSizeMin ?? null,
      investmentSizeMax: op?.investmentSizeMax ?? null,
      publishDate: op?.publishDate ?? null,
      auctionUrl: op?.auctionUrl ?? null,
      featuredInSanity: op?.featured ?? false,
      kycBuyerForm: op?.kycBuyerForm ?? null,
      // governance meta
      metaStatus: meta?.status ?? null,
      metaTags: (meta?.tags as string[] | null) ?? [],
      metaVisibilityTier: meta?.visibilityTier ?? null,
      metaNotes: meta?.notes ?? null,
      // analytics
      views: analytics?.views ?? 0,
      uniqueViewers: analytics?.viewers.size ?? 0,
      saves: savesBy.get(id) ?? 0,
      orders: ordersBy.get(id) ?? 0,
      revenueUsd: Math.round((revenueBy.get(id) ?? 0) * 100) / 100,
    }
  })

  return {rows, sanityConfigured: sanityOps.length > 0, studioUrl: sanityStudioUrl()}
}

// ---------------------------------------------------------------------------
// Market Intelligence CMS
// ---------------------------------------------------------------------------

export async function intelligenceList() {
  const [reports, metaRows] = await Promise.all([
    getAdminReports(),
    unwrap<ContentMetaRow[]>(await supabase.from('content_meta').select('*').eq('content_type', 'report'), 'contentMeta.list'),
  ])
  const metas = toCamelList(metaRows)
  const metaBy = new Map(metas.map((m) => [m.sanityId, m]))
  const ids = new Set<string>([...reports.map((r) => r._id), ...metas.map((m) => m.sanityId)])
  const reportById = new Map(reports.map((r) => [r._id, r]))

  return {
    rows: [...ids].map((id) => {
      const r = reportById.get(id)
      const meta = metaBy.get(id)
      return {
        sanityId: id,
        title: r?.title ?? meta?.title ?? id,
        category: r?.category ?? 'commentary',
        geography: r?.geography ?? null,
        accessTier: (r?.accessTier ?? 'tier_1') as AccessTier,
        publishDate: r?.publishDate ?? null,
        metaStatus: meta?.status ?? null,
        metaVisibilityTier: meta?.visibilityTier ?? null,
        metaNotes: meta?.notes ?? null,
      }
    }),
    sanityConfigured: reports.length > 0,
    studioUrl: sanityStudioUrl(),
  }
}

// ---------------------------------------------------------------------------
// Settings, staff, sessions, audit
// ---------------------------------------------------------------------------

export async function staffList() {
  const staffRows = unwrap<UserRow[]>(
    await supabase.from('users').select('*').in('role', ['advisor', 'admin']).order('created_at', {ascending: true}),
    'users.list',
  )
  const profileRows = unwrap<StaffProfileRow[]>(await supabase.from('staff_profiles').select('*'), 'staffProfiles.list')
  const profileBy = new Map(profileRows.map((p) => [p.user_id, p]))
  return staffRows.map((s) => ({
    userId: s.id,
    email: s.email,
    fullName: s.full_name,
    role: s.role,
    status: s.status,
    lastLoginAt: s.last_login_at,
    createdAt: s.created_at,
    mfaEnabled: s.mfa_enabled,
    adminRole: profileBy.get(s.id)?.admin_role ?? (s.role === 'admin' ? 'super_admin' : 'advisor'),
    hasStaffProfile: profileBy.has(s.id),
    title: profileBy.get(s.id)?.title ?? null,
    team: profileBy.get(s.id)?.team ?? null,
    isActive: profileBy.get(s.id)?.is_active ?? true,
  }))
}

export async function settingsData() {
  const [settingRows, staff] = await Promise.all([
    unwrap<SystemSettingRow[]>(await supabase.from('system_settings').select('*').order('key', {ascending: true}), 'systemSettings.list'),
    staffList(),
  ])
  const settings = toCamelList(settingRows)

  const integrationStatus = [
    {key: 'smtp', label: 'Email (SMTP)', configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER), detail: process.env.SMTP_HOST ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? '587'}` : 'SMTP_HOST / SMTP_USER not set'},
    {key: 'sanity', label: 'Sanity CMS', configured: !!process.env.SANITY_PROJECT_ID && process.env.SANITY_PROJECT_ID !== 'your-project-id', detail: process.env.SANITY_PROJECT_ID ? `dataset: ${process.env.SANITY_DATASET || 'production'}` : 'SANITY_PROJECT_ID not set'},
    {key: 'payments', label: 'Payments (M-Pesa / wire / card)', configured: !!process.env.MPESA_SHORTCODE || !!process.env.PAYMENTS_MODE, detail: process.env.MPESA_SHORTCODE ? 'M-Pesa shortcode configured' : 'Manual verification mode (payments verified by staff)'},
    {key: 'auctions', label: 'Auctions (auctions.murivest.com)', configured: true, detail: 'Linked from opportunity records via auctionUrl'},
  ]

  return {settings, staff, integrationStatus}
}

export async function sessionsOverview() {
  const sessionRows = unwrap<SessionRow[]>(
    await supabase.from('sessions').select('*').order('last_seen_at', {ascending: false}).limit(100),
    'sessions.list',
  )
  // relation include → separate query + JS join
  const sessionUserIds = [...new Set(sessionRows.map((s) => s.user_id))]
  const sessionUserRows = sessionUserIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', sessionUserIds), 'users.list')
    : []
  const sessionUserBy = new Map(sessionUserRows.map((u) => [u.id, u]))

  const secEventRows = unwrap<SecurityEventRow[]>(
    await supabase.from('security_events').select('*').order('created_at', {ascending: false}).limit(50),
    'securityEvents.list',
  )
  const secUserIds = [...new Set(secEventRows.map((e) => e.user_id).filter((x): x is string => !!x))]
  const secUserRows = secUserIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', secUserIds), 'users.list') : []
  const secUserBy = new Map(secUserRows.map((u) => [u.id, u]))

  return {
    sessions: sessionRows.map((s) => {
      const u = sessionUserBy.get(s.user_id)
      return {
        ...toCamel(s),
        user: u ? {id: u.id, email: u.email, fullName: u.full_name, role: u.role, status: u.status} : null,
      }
    }),
    securityEvents: secEventRows.map((e) => {
      const u = secUserBy.get(e.user_id ?? '')
      return {
        ...toCamel(e),
        user: u ? {email: u.email, fullName: u.full_name} : null,
      }
    }),
  }
}

export async function auditViewer(opts: {actorId?: string; entity?: string; action?: string; search?: string; limit?: number} = {}) {
  let logQuery = auditTable().select('*').order('created_at', {ascending: false}).limit(opts.limit ?? 150)
  if (opts.actorId) logQuery = logQuery.eq('actor_id', opts.actorId)
  if (opts.entity) logQuery = logQuery.eq('entity', opts.entity)
  if (opts.action) logQuery = logQuery.like('action', `%${opts.action}%`)
  let logs = toCamelList(unwrap<AuditLogRow[]>(await logQuery, 'audit.list'))

  const search = opts.search?.trim().toLowerCase()
  if (search) {
    logs = logs.filter((l) => JSON.stringify(l.detail ?? {}).toLowerCase().includes(search) || l.action.toLowerCase().includes(search) || (l.entityId ?? '').toLowerCase().includes(search))
  }

  const actorIds = [...new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x))]
  const actorRows = actorIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', actorIds), 'users.list') : []
  const actorBy = new Map(actorRows.map((a) => [a.id, {id: a.id, fullName: a.full_name, email: a.email, role: a.role}]))

  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    actorType: l.actorType,
    actorName: l.actorId ? actorBy.get(l.actorId)?.fullName || actorBy.get(l.actorId)?.email || l.actorId : null,
    actorRole: l.actorId ? actorBy.get(l.actorId)?.role ?? null : null,
    detail: l.detail,
    ip: l.ip,
    createdAt: l.createdAt,
  }))
}

// ---------------------------------------------------------------------------
// Command Centre
// ---------------------------------------------------------------------------

export async function commandCentre(actx: AdminContext, period: Period) {
  const scope = investorScopeWhere(actx)
  const assignedUserIds = actx.advisorId
    ? unwrap<InvestorProfileRow[]>(
        await supabase.from('investor_profiles').select('*').eq('advisor_id', actx.auth.user.id),
        'profiles.list',
      ).map((p) => p.user_id)
    : null

  const [revenue, pendingRows, openOrderRows, stalledMandateRows, openEnquiryRows, activityRows, paymentsToVerify, ordersToAssign, docRequestsPending, advisorRows] = await Promise.all([
    revenueCardMetrics(period),
    (async () => {
      let q = supabase.from('investor_profiles').select('*')
      if (scope) q = q.eq('advisor_id', scope.advisorId)
      return unwrap<InvestorProfileRow[]>(
        await q
          .or('verification_status.in.("kyc_pending","in_review"),kyc_status.in.("submitted","in_review")')
          .order('updated_at', {ascending: true})
          .limit(10),
        'profiles.list',
      )
    })(),
    (async () => {
      let q = supabase.from('orders').select('*').in('status', OPEN_STATUSES)
      if (assignedUserIds) q = q.in('user_id', assignedUserIds)
      return unwrap<OrderRow[]>(await q.order('priority', {ascending: false}).order('created_at', {ascending: true}).limit(10), 'orders.list')
    })(),
    assignedUserIds
      ? mandatesByAdvisorScope(actx.auth.user.id, assignedUserIds, {status: 'active', ascending: true, limit: 10})
      : unwrap<MandateRow[]>(
          await supabase.from('mandates').select('*').eq('status', 'active').order('updated_at', {ascending: true}).limit(10),
          'mandates.list',
        ),
    (async () => {
      let q = supabase.from('enquiries').select('*').eq('status', 'open')
      if (assignedUserIds) q = q.in('user_id', assignedUserIds)
      return unwrap<EnquiryRow[]>(await q.order('created_at', {ascending: true}).limit(10), 'enquiries.list')
    })(),
    unwrap<AuditLogRow[]>(await auditTable().select('*').order('created_at', {ascending: false}).limit(20), 'audit.recent'),
    unwrapCount(await supabase.from('payments').select('*', {count: 'exact', head: true}).eq('status', 'submitted'), 'payments.count'),
    unwrapCount(
      await supabase
        .from('orders')
        .select('*', {count: 'exact', head: true})
        .in('status', ['payment_confirmed', 'processing'])
        .is('assigned_to_id', null),
      'orders.count',
    ),
    unwrapCount(await supabase.from('document_requests').select('*', {count: 'exact', head: true}).eq('status', 'submitted'), 'documentRequests.count'),
    unwrap<UserRow[]>(await supabase.from('users').select('*').in('role', ['advisor', 'admin']), 'users.list'),
  ])

  // relation include → separate query + JS join
  const pendingUserIds = pendingRows.map((p) => p.user_id)
  const pendingUserRows = pendingUserIds.length
    ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', pendingUserIds), 'users.list')
    : []
  const pendingUserBy = new Map(pendingUserRows.map((u) => [u.id, u]))

  // relation include (payments.status) → separate query + JS join
  const openOrderIds = openOrderRows.map((o) => o.id)
  const openOrderPaymentRows = openOrderIds.length
    ? unwrap<PaymentRow[]>(await supabase.from('payments').select('*').in('order_id', openOrderIds), 'payments.list')
    : []
  const openOrderPaymentsBy = new Map<string, PaymentRow[]>()
  for (const p of openOrderPaymentRows) {
    const arr = openOrderPaymentsBy.get(p.order_id) ?? []
    arr.push(p)
    openOrderPaymentsBy.set(p.order_id, arr)
  }

  // relation include (non-investor messages, id only) → separate query + JS join
  const openEnquiryIds = openEnquiryRows.map((e) => e.id)
  const staffMessageRows = openEnquiryIds.length
    ? unwrap<MessageRow[]>(
        await supabase.from('messages').select('*').in('enquiry_id', openEnquiryIds).not('sender_type', 'eq', 'investor'),
        'messages.list',
      )
    : []
  const staffMessagesBy = new Map<string, MessageRow[]>()
  for (const m of staffMessageRows) {
    const arr = staffMessagesBy.get(m.enquiry_id) ?? []
    arr.push(m)
    staffMessagesBy.set(m.enquiry_id, arr)
  }

  const actorIds = [...new Set(activityRows.map((a) => a.actor_id).filter((x): x is string => !!x))]
  const actorRows = actorIds.length ? unwrap<UserRow[]>(await supabase.from('users').select('*').in('id', actorIds), 'users.list') : []
  const actorBy = new Map(actorRows.map((a) => [a.id, a.full_name || a.email]))
  const activity = toCamelList(activityRows)

  const now = Date.now()
  return {
    revenue,
    queues: {
      pendingVerifications: pendingRows.map((p) => {
        const u = pendingUserBy.get(p.user_id)
        return {
          userId: p.user_id,
          name: u?.full_name || u?.email || p.user_id,
          email: u?.email ?? '',
          verificationStatus: p.verification_status,
          kycStatus: p.kyc_status,
          accessTier: p.access_tier,
          waitingDays: Math.floor((now - new Date(p.created_at).getTime()) / 86400000),
        }
      }),
      openOrders: openOrderRows.map((o) => ({
        id: o.id,
        reference: o.reference,
        briefTitle: o.brief_title,
        status: o.status,
        priority: o.priority,
        amountUsd: o.amount_usd,
        currency: o.currency,
        createdAt: o.created_at,
        dueAt: o.due_at,
        assigned: !!o.assigned_to_id,
        paid: (openOrderPaymentsBy.get(o.id) ?? []).some((p) => p.status === 'verified'),
      })),
      stalledMandates: stalledMandateRows.map((m) => ({
        id: m.id,
        reference: m.reference,
        title: m.title,
        stage: m.stage,
        probability: m.probability,
        nextAction: m.next_action,
        nextActionDue: m.next_action_due,
        daysSinceUpdate: Math.floor((now - new Date(m.updated_at).getTime()) / 86400000),
      })),
      openEnquiries: openEnquiryRows.map((e) => ({
        id: e.id,
        subject: e.subject,
        createdAt: e.created_at,
        awaitingReply: (staffMessagesBy.get(e.id) ?? []).length === 0,
      })),
    },
    activity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      actorName: a.actorId ? actorBy.get(a.actorId) ?? a.actorId : 'System',
      actorType: a.actorType,
      createdAt: a.createdAt,
      detail: a.detail,
    })),
    quickActions: {
      paymentsToVerify,
      ordersToAssign,
      docRequestsPending,
      newEnquiries: openEnquiryRows.length,
    },
    advisors: advisorRows.map((a) => ({id: a.id, name: a.full_name || a.email, role: a.role})),
  }
}

export {OPEN_STATUSES}
