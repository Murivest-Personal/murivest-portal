import {cache} from 'react'
import {db} from '@/lib/db'
import {sanityClient} from '@/lib/sanity/client'
import type {OpportunityDoc, MarketReportDoc, AccessTier} from '@/lib/sanity/types'
import type {AdminContext} from './rbac'
import {investorScopeWhere} from './rbac'
import {revenueCardMetrics} from './revenue'
import type {Period} from './period'

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
  financials, summary, auctionUrl, featured, publishDate
}`

export const getAdminOpportunities = cache(async (): Promise<OpportunityDoc[]> => {
  const client = sanityClient()
  if (!client) return []
  return client.fetch(
    `*[_type == "opportunity" && defined(published) && published == true] | order(publishDate desc, title asc) ${ADMIN_OPP_PROJECTION}`,
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

  const profiles = await db.investorProfile.findMany({
    where: {
      ...(scope ?? {}),
      ...(opts.tier ? {accessTier: opts.tier} : {}),
      ...(opts.verification ? {verificationStatus: opts.verification} : {}),
      ...(opts.classification ? {classification: opts.classification} : {}),
    },
    include: {
      user: {select: {id: true, email: true, fullName: true, status: true, lastLoginAt: true, createdAt: true}},
    },
    orderBy: {createdAt: 'desc'},
    take: opts.limit ?? 500,
  })

  let rows = profiles.filter((p) => {
    if (!search) return true
    return (
      p.user.email.toLowerCase().includes(search) ||
      (p.user.fullName ?? '').toLowerCase().includes(search) ||
      (p.countryResidence ?? '').toLowerCase().includes(search)
    )
  })

  if (opts.dormant) {
    const cutoff = Date.now() - 60 * 86400000
    rows = rows.filter((p) => !p.user.lastLoginAt || p.user.lastLoginAt.getTime() < cutoff)
  }

  const userIds = rows.map((r) => r.userId)
  const [orders, revenueEvents, mandates, orgs] = await Promise.all([
    userIds.length ? db.order.findMany({where: {userId: {in: userIds}}, select: {userId: true}}) : [],
    userIds.length ? db.revenueEvent.findMany({select: {grossUsd: true, order: {select: {userId: true}}}}) : [],
    userIds.length ? db.mandate.findMany({where: {userId: {in: userIds}, status: 'active'}, select: {userId: true}}) : [],
    db.organisation.findMany({select: {id: true, name: true}}),
  ])
  const orderCount = new Map<string, number>()
  for (const o of orders) orderCount.set(o.userId, (orderCount.get(o.userId) ?? 0) + 1)
  const revenueBy = new Map<string, number>()
  for (const e of revenueEvents) revenueBy.set(e.order.userId, (revenueBy.get(e.order.userId) ?? 0) + e.grossUsd)
  const mandateCount = new Map<string, number>()
  for (const m of mandates) mandateCount.set(m.userId, (mandateCount.get(m.userId) ?? 0) + 1)
  const orgNames = new Map(orgs.map((o) => [o.id, o.name]))

  return rows.map((p) => ({
    userId: p.userId,
    email: p.user.email,
    fullName: p.user.fullName,
    status: p.user.status,
    classification: p.classification,
    verificationStatus: p.verificationStatus,
    kycStatus: p.kycStatus,
    amlStatus: p.amlStatus,
    accessTier: p.accessTier,
    ndaAccepted: p.ndaAccepted,
    advisorId: p.advisorId,
    source: p.source,
    countryResidence: p.countryResidence,
    organisationId: p.organisationId,
    organisationName: p.organisationId ? orgNames.get(p.organisationId) ?? null : null,
    equityAvailable: p.equityAvailable,
    totalCapacity: p.totalCapacity,
    capitalFloor: p.capitalFloor,
    capitalCeiling: p.capitalCeiling,
    capitalCurrency: p.capitalCurrency,
    createdAt: p.user.createdAt,
    lastLoginAt: p.user.lastLoginAt,
    orderCount: orderCount.get(p.userId) ?? 0,
    revenueUsd: Math.round((revenueBy.get(p.userId) ?? 0) * 100) / 100,
    activeMandates: mandateCount.get(p.userId) ?? 0,
  }))
}

export async function investorDetail(actx: AdminContext, userId: string) {
  const scope = investorScopeWhere(actx)
  const profile = await db.investorProfile.findUnique({
    where: {userId},
    include: {user: {select: {id: true, email: true, fullName: true, status: true, lastLoginAt: true, createdAt: true, emailVerifiedAt: true, mfaEnabled: true, failedLogins: true, lockedUntil: true}}},
  })
  if (!profile) return null
  if (scope && profile.advisorId !== actx.auth.user.id) return null

  const [org, orders, mandates, grants, sessions, secEvents, notes, reviews, criteria, savedCount, scenarioCount, enquiriesCount, auditTrail, advisor] = await Promise.all([
    profile.organisationId
      ? db.organisation.findUnique({where: {id: profile.organisationId}, include: {members: {include: {user: {select: {id: true, fullName: true, email: true}}}}}})
      : null,
    db.order.findMany({where: {userId}, orderBy: {createdAt: 'desc'}, select: {id: true, reference: true, briefTitle: true, briefType: true, status: true, amountUsd: true, currency: true, createdAt: true, deliveredAt: true}}),
    db.mandate.findMany({where: {userId}, orderBy: {createdAt: 'desc'}, select: {id: true, reference: true, title: true, status: true, stage: true, probability: true, targetAllocationMin: true, targetAllocationMax: true, currency: true, createdAt: true}}),
    db.documentGrant.findMany({where: {userId}, orderBy: {createdAt: 'desc'}, select: {id: true, sanityDocumentId: true, permission: true, expiresAt: true, createdAt: true}}),
    db.session.findMany({where: {userId}, orderBy: {lastSeenAt: 'desc'}, take: 6, select: {id: true, device: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true}}),
    db.securityEvent.findMany({where: {userId}, orderBy: {createdAt: 'desc'}, take: 12, select: {id: true, type: true, ip: true, createdAt: true}}),
    db.internalNote.findMany({where: {entityType: 'investor', entityId: userId}, orderBy: {createdAt: 'desc'}, select: {id: true, authorId: true, body: true, visibility: true, createdAt: true}}),
    db.complianceReview.findMany({where: {subjectUserId: userId}, orderBy: {createdAt: 'desc'}, take: 20, select: {id: true, reviewerId: true, decision: true, notes: true, riskFlags: true, detail: true, createdAt: true}}),
    db.investorCriteria.findUnique({where: {userId}}),
    db.savedOpportunity.count({where: {userId}}),
    db.scenario.count({where: {userId}}),
    db.enquiry.count({where: {userId}}),
    db.auditLog.findMany({
      where: {OR: [{actorId: userId}, {AND: [{entity: 'profile'}, {entityId: profile.id}]}]},
      orderBy: {createdAt: 'desc'},
      take: 40,
      select: {id: true, action: true, entity: true, entityId: true, actorType: true, detail: true, ip: true, createdAt: true},
    }),
    profile.advisorId ? db.user.findUnique({where: {id: profile.advisorId}, select: {id: true, fullName: true, email: true}}) : null,
  ])

  const staffIds = [...new Set([...notes.map((n) => n.authorId), ...reviews.map((r) => r.reviewerId)].filter((x): x is string => !!x))]
  const staff = staffIds.length ? await db.user.findMany({where: {id: {in: staffIds}}, select: {id: true, fullName: true, email: true}}) : []
  const staffNames = new Map(staff.map((s) => [s.id, s.fullName || s.email]))

  return {
    profile,
    user: profile.user,
    organisation: org,
    advisor,
    orders,
    mandates,
    grants,
    sessions,
    securityEvents: secEvents,
    notes: notes.map((n) => ({...n, authorName: staffNames.get(n.authorId) ?? 'Staff'})),
    reviews: reviews.map((r) => ({...r, reviewerName: staffNames.get(r.reviewerId) ?? 'Staff'})),
    criteria,
    stats: {savedCount, scenarioCount, enquiriesCount},
    auditTrail,
  }
}

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

export async function organisationList() {
  const orgs = await db.organisation.findMany({
    include: {
      members: {include: {user: {select: {id: true, fullName: true, email: true, lastLoginAt: true, status: true}}}},
      _count: {select: {members: true}},
    },
    orderBy: {createdAt: 'desc'},
  })
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    legalName: o.legalName,
    type: o.type,
    country: o.country,
    website: o.website,
    verified: o.verified,
    createdAt: o.createdAt,
    members: o.members.map((m) => ({id: m.id, userId: m.userId, name: m.user.fullName || m.user.email, email: m.user.email, role: m.role, title: m.title, status: m.status, lastLoginAt: m.user.lastLoginAt})),
  }))
}

// ---------------------------------------------------------------------------
// Orders (Orders Engine)
// ---------------------------------------------------------------------------

const OPEN_STATUSES = ['pending', 'awaiting_payment', 'payment_confirmed', 'processing', 'internal_review', 'ready']

export async function orderList(
  actx: AdminContext,
  opts: {status?: string; search?: string; priority?: string; assignedTo?: string; limit?: number} = {},
) {
  const assignedUserIds = actx.advisorId
    ? (await db.investorProfile.findMany({where: {advisorId: actx.auth.user.id}, select: {userId: true}})).map((p) => p.userId)
    : null

  const where: Record<string, unknown> = {}
  if (opts.status === 'open') where.status = {in: OPEN_STATUSES}
  else if (opts.status) where.status = opts.status
  if (opts.priority) where.priority = opts.priority
  if (opts.assignedTo === 'me') where.assignedToId = actx.auth.user.id
  else if (opts.assignedTo === 'unassigned') where.assignedToId = null
  if (assignedUserIds) where.userId = {in: assignedUserIds}

  let orders = await db.order.findMany({
    where,
    orderBy: [{createdAt: 'desc'}],
    take: opts.limit ?? 400,
    include: {payments: {select: {id: true, status: true, method: true, amountUsd: true, amountKes: true, reference: true, createdAt: true, verifiedAt: true}}},
  })

  const search = opts.search?.trim().toLowerCase()
  if (search) {
    orders = orders.filter(
      (o) =>
        o.reference.toLowerCase().includes(search) ||
        o.briefTitle.toLowerCase().includes(search) ||
        (o.contactEmail ?? '').toLowerCase().includes(search) ||
        (o.contactName ?? '').toLowerCase().includes(search),
    )
  }

  const userIds = [...new Set(orders.map((o) => o.userId))]
  const profiles = userIds.length
    ? await db.investorProfile.findMany({where: {userId: {in: userIds}}, select: {userId: true, classification: true, accessTier: true, advisorId: true, organisationId: true}})
    : []
  const users = userIds.length ? await db.user.findMany({where: {id: {in: userIds}}, select: {id: true, fullName: true, email: true}}) : []
  const orgIds = [...new Set(profiles.map((p) => p.organisationId).filter((x): x is string => !!x))]
  const orgs = orgIds.length ? await db.organisation.findMany({where: {id: {in: orgIds}}, select: {id: true, name: true}}) : []
  const profileBy = new Map(profiles.map((p) => [p.userId, p]))
  const userBy = new Map(users.map((u) => [u.id, u]))
  const orgBy = new Map(orgs.map((o) => [o.id, o.name]))

  return orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    userId: o.userId,
    investorName: userBy.get(o.userId)?.fullName || userBy.get(o.userId)?.email || o.userId,
    investorEmail: userBy.get(o.userId)?.email ?? '',
    investorClass: profileBy.get(o.userId)?.classification ?? 'individual',
    investorTier: profileBy.get(o.userId)?.accessTier ?? 'tier_1',
    organisationName: profileBy.get(o.userId)?.organisationId ? orgBy.get(profileBy.get(o.userId)!.organisationId!) ?? null : null,
    briefTitle: o.briefTitle,
    briefType: o.briefType,
    briefSource: o.briefSource,
    format: o.format,
    customScope: o.customScope,
    status: o.status,
    priority: o.priority,
    assignedToId: o.assignedToId,
    advisorId: o.advisorId ?? profileBy.get(o.userId)?.advisorId ?? null,
    amountUsd: o.amountUsd,
    amountKes: o.amountKes,
    currency: o.currency,
    createdAt: o.createdAt,
    dueAt: o.dueAt,
    deliveredAt: o.deliveredAt,
    closedAt: o.closedAt,
    payment: o.payments[0] ?? null,
    hasVerifiedPayment: o.payments.some((p) => p.status === 'verified'),
  }))
}

export async function orderDetail(actx: AdminContext, orderId: string) {
  const order = await db.order.findUnique({
    where: {id: orderId},
    include: {payments: true},
  })
  if (!order) return null

  const [profile, user, events, notes, refunds, revenue] = await Promise.all([
    db.investorProfile.findUnique({where: {userId: order.userId}}),
    db.user.findUnique({where: {id: order.userId}, select: {id: true, fullName: true, email: true, status: true}}),
    db.orderStatusEvent.findMany({where: {orderId}, orderBy: {createdAt: 'asc'}}),
    db.internalNote.findMany({where: {entityType: 'order', entityId: orderId}, orderBy: {createdAt: 'desc'}}),
    db.refundAdjustment.findMany({where: {orderId}, orderBy: {createdAt: 'desc'}}),
    db.revenueEvent.findUnique({where: {orderId}}),
  ])

  if (actx.advisorId && profile?.advisorId !== actx.auth.user.id) return null

  const staffIds = [
    ...new Set(
      [
        ...events.map((e) => e.changedById),
        ...notes.map((n) => n.authorId),
        ...refunds.map((r) => r.requestedById),
        ...refunds.map((r) => r.reviewedById ?? null),
        order.assignedToId,
        order.advisorId,
        profile?.advisorId ?? null,
      ].filter((x): x is string => !!x),
    ),
  ]
  const staff = staffIds.length ? await db.user.findMany({where: {id: {in: staffIds}}, select: {id: true, fullName: true, email: true}}) : []
  const staffNames = new Map(staff.map((s) => [s.id, s.fullName || s.email]))

  const assignments = await db.order.findUnique({where: {id: orderId}, select: {assignedToId: true, advisorId: true}})

  return {
    order,
    investor: {user, profile},
    payments: order.payments,
    events: events.map((e) => ({...e, changedByName: e.changedById ? staffNames.get(e.changedById) ?? 'Staff' : 'System'})),
    notes: notes.map((n) => ({...n, authorName: staffNames.get(n.authorId) ?? 'Staff'})),
    refunds: refunds.map((r) => ({
      ...r,
      requestedByName: staffNames.get(r.requestedById) ?? 'Staff',
      reviewedByName: r.reviewedById ? staffNames.get(r.reviewedById) ?? 'Staff' : null,
    })),
    revenue,
    assignment: {
      assignedToName: assignments?.assignedToId ? staffNames.get(assignments.assignedToId) ?? null : null,
      advisorName: (assignments?.advisorId ?? profile?.advisorId ?? null) ? staffNames.get(assignments?.advisorId ?? profile!.advisorId!) ?? null : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Mandates & pipeline
// ---------------------------------------------------------------------------

export async function mandateList(
  actx: AdminContext,
  opts: {status?: string; stage?: string; search?: string; limit?: number} = {},
) {
  const assignedUserIds = actx.advisorId
    ? (await db.investorProfile.findMany({where: {advisorId: actx.auth.user.id}, select: {userId: true}})).map((p) => p.userId)
    : null

  const where: Record<string, unknown> = {}
  if (opts.status) where.status = opts.status
  if (opts.stage) where.stage = opts.stage
  if (assignedUserIds) where.OR = [{userId: {in: assignedUserIds}}, {advisorId: actx.auth.user.id}]

  let mandates = await db.mandate.findMany({
    where,
    orderBy: {updatedAt: 'desc'},
    take: opts.limit ?? 300,
    include: {milestones: {orderBy: {createdAt: 'asc'}, select: {id: true, title: true, status: true, dueDate: true}}},
  })

  const search = opts.search?.trim().toLowerCase()
  if (search) mandates = mandates.filter((m) => m.reference.toLowerCase().includes(search) || m.title.toLowerCase().includes(search))

  const userIds = [...new Set(mandates.map((m) => m.userId))]
  const users = userIds.length ? await db.user.findMany({where: {id: {in: userIds}}, select: {id: true, fullName: true, email: true}}) : []
  const userBy = new Map(users.map((u) => [u.id, u]))
  const advisors = await db.user.findMany({where: {role: {in: ['advisor', 'admin']}}, select: {id: true, fullName: true, email: true}})
  const advisorNames = new Map(advisors.map((a) => [a.id, a.fullName || a.email]))

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
    investorName: userBy.get(m.userId)?.fullName || userBy.get(m.userId)?.email || m.userId,
    investorEmail: userBy.get(m.userId)?.email ?? '',
    advisorId: m.advisorId,
    advisorName: m.advisorId ? advisorNames.get(m.advisorId) ?? null : null,
    milestones: m.milestones,
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
  const [grants, requests, accessLogs, metas] = await Promise.all([
    db.documentGrant.findMany({orderBy: {createdAt: 'desc'}, take: 400, select: {id: true, sanityDocumentId: true, userId: true, organisationId: true, permission: true, expiresAt: true, grantedById: true, createdAt: true}}),
    db.documentRequest.findMany({orderBy: {createdAt: 'desc'}, take: 200}),
    db.documentAccessLog.findMany({orderBy: {createdAt: 'desc'}, take: 300, select: {id: true, userId: true, sanityDocumentId: true, documentTitle: true, action: true, ip: true, createdAt: true}}),
    db.contentMeta.findMany({where: {contentType: 'document'}, select: {sanityId: true, status: true, visibilityTier: true, tags: true, notes: true}}),
  ])

  const userIds = [...new Set([...grants.map((g) => g.userId ?? ''), ...accessLogs.map((l) => l.userId), ...requests.map((r) => r.userId)].filter(Boolean))]
  const users = userIds.length ? await db.user.findMany({where: {id: {in: userIds}}, select: {id: true, fullName: true, email: true}}) : []
  const userBy = new Map(users.map((u) => [u.id, u.fullName || u.email]))

  // Sanity document titles (server-side, all tiers)
  const client = sanityClient()
  const sanityDocs = client
    ? await client.fetch(`*[_type == "document" && defined(published) && published == true] | order(title asc) {_id, title, docType, accessTier, downloadable, publishDate, "fileExtension": file.asset->extension}`).catch(() => [])
    : []

  return {
    grants: grants.map((g) => ({...g, userName: g.userId ? userBy.get(g.userId) ?? g.userId : null})),
    requests: requests.map((r) => ({...r, userName: userBy.get(r.userId) ?? r.userId})),
    accessLogs: accessLogs.map((l) => ({...l, userName: userBy.get(l.userId) ?? l.userId})),
    metas,
    sanityDocs,
    sanityConfigured: !!client,
  }
}

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------

export async function communicationsData(actx: AdminContext, opts: {status?: string} = {}) {
  const assignedUserIds = actx.advisorId
    ? (await db.investorProfile.findMany({where: {advisorId: actx.auth.user.id}, select: {userId: true}})).map((p) => p.userId)
    : null

  const enquiries = await db.enquiry.findMany({
    where: {
      ...(opts.status ? {status: opts.status} : {}),
      ...(assignedUserIds ? {userId: {in: assignedUserIds}} : {}),
    },
    orderBy: {createdAt: 'desc'},
    take: 200,
    include: {messages: {orderBy: {createdAt: 'asc'}}},
  })

  const userIds = [...new Set(enquiries.map((e) => e.userId))]
  const users = userIds.length ? await db.user.findMany({where: {id: {in: userIds}}, select: {id: true, fullName: true, email: true}}) : []
  const profiles = userIds.length ? await db.investorProfile.findMany({where: {userId: {in: userIds}}, select: {userId: true, classification: true, accessTier: true, advisorId: true}}) : []
  const userBy = new Map(users.map((u) => [u.id, u]))
  const profileBy = new Map(profiles.map((p) => [p.userId, p]))
  const advisors = await db.user.findMany({where: {role: {in: ['advisor', 'admin']}}, select: {id: true, fullName: true, email: true}})
  const advisorNames = new Map(advisors.map((a) => [a.id, a.fullName || a.email]))

  const threads = enquiries.map((e) => {
    const lastAdvisorMsg = [...e.messages].reverse().find((m) => m.senderType !== 'investor')
    return {
      id: e.id,
      userId: e.userId,
      investorName: userBy.get(e.userId)?.fullName || userBy.get(e.userId)?.email || e.userId,
      investorEmail: userBy.get(e.userId)?.email ?? '',
      investorClass: profileBy.get(e.userId)?.classification ?? 'individual',
      tier: profileBy.get(e.userId)?.accessTier ?? 'tier_1',
      assignedAdvisor: profileBy.get(e.userId)?.advisorId ?? null,
      assignedAdvisorName: profileBy.get(e.userId)?.advisorId ? advisorNames.get(profileBy.get(e.userId)!.advisorId!) ?? null : null,
      subject: e.subject,
      opportunityTitle: e.opportunityTitle,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      messages: e.messages.map((m) => ({id: m.id, senderType: m.senderType, senderId: m.senderId, senderName: m.senderId ? advisorNames.get(m.senderId) ?? null : null, body: m.body, createdAt: m.createdAt, readAt: m.readAt})),
      awaitingReply: !lastAdvisorMsg,
      lastActivityAt: e.messages.length > 0 ? e.messages[e.messages.length - 1].createdAt : e.createdAt,
    }
  })

  const notes = await db.internalNote.findMany({where: {entityType: 'enquiry'}, orderBy: {createdAt: 'desc'}, take: 100})

  return {threads, notes}
}

// ---------------------------------------------------------------------------
// Compliance workspace
// ---------------------------------------------------------------------------

export async function complianceQueue() {
  const [pending, ndaGaps, docRequests, flagged, reviews, ndaVersions] = await Promise.all([
    db.investorProfile.findMany({
      where: {OR: [{verificationStatus: {in: ['kyc_pending', 'in_review', 'profile_submitted']}}, {kycStatus: {in: ['submitted', 'in_review']}}]},
      include: {user: {select: {id: true, email: true, fullName: true, createdAt: true, lastLoginAt: true, status: true}}},
      orderBy: {updatedAt: 'desc'},
    }),
    db.investorProfile.findMany({
      where: {accessTier: {in: ['tier_2', 'tier_3']}, ndaAccepted: false},
      include: {user: {select: {id: true, email: true, fullName: true}}},
    }),
    db.documentRequest.findMany({where: {status: {in: ['submitted', 'in_review']}}, orderBy: {createdAt: 'asc'}}),
    db.investorProfile.findMany({
      where: {OR: [{amlStatus: 'flagged'}, {user: {status: {in: ['suspended', 'locked']}}}]},
      include: {user: {select: {id: true, email: true, fullName: true, status: true}}},
    }),
    db.complianceReview.findMany({orderBy: {createdAt: 'desc'}, take: 50}),
    db.ndaAgreement.findMany({orderBy: {createdAt: 'desc'}, take: 100, select: {id: true, userId: true, version: true, ip: true, createdAt: true}}),
  ])

  const staffIds = [...new Set(reviews.map((r) => r.reviewerId))]
  const staff = staffIds.length ? await db.user.findMany({where: {id: {in: staffIds}}, select: {id: true, fullName: true, email: true}}) : []
  const staffNames = new Map(staff.map((s) => [s.id, s.fullName || s.email]))
  const requestUserIds = [...new Set(docRequests.map((r) => r.userId))]
  const requestUsers = requestUserIds.length ? await db.user.findMany({where: {id: {in: requestUserIds}}, select: {id: true, fullName: true, email: true}}) : []
  const requestUserBy = new Map(requestUsers.map((u) => [u.id, u.fullName || u.email]))

  return {
    pending: pending.map((p) => ({
      userId: p.userId,
      profileId: p.id,
      email: p.user.email,
      fullName: p.user.fullName,
      accountStatus: p.user.status,
      classification: p.classification,
      verificationStatus: p.verificationStatus,
      kycStatus: p.kycStatus,
      amlStatus: p.amlStatus,
      accessTier: p.accessTier,
      ndaAccepted: p.ndaAccepted,
      nationality: p.nationality,
      countryResidence: p.countryResidence,
      advisorId: p.advisorId,
      createdAt: p.user.createdAt,
      updatedAt: p.updatedAt,
    })),
    ndaGaps: ndaGaps.map((p) => ({userId: p.userId, email: p.user.email, fullName: p.user.fullName, accessTier: p.accessTier})),
    docRequests: docRequests.map((r) => ({...r, userName: requestUserBy.get(r.userId) ?? r.userId})),
    flagged: flagged.map((p) => ({userId: p.userId, email: p.user.email, fullName: p.user.fullName, accountStatus: p.user.status, amlStatus: p.amlStatus, accessTier: p.accessTier})),
    reviews: reviews.map((r) => ({...r, reviewerName: staffNames.get(r.reviewerId) ?? 'Staff'})),
    ndaVersions,
  }
}

// ---------------------------------------------------------------------------
// Opportunity inventory (Sanity + interaction analytics + governance meta)
// ---------------------------------------------------------------------------

export async function opportunityInventory() {
  const [sanityOps, metas, views, saves, orders, revenueEvents] = await Promise.all([
    getAdminOpportunities(),
    db.contentMeta.findMany({where: {contentType: 'opportunity'}}),
    db.opportunityView.findMany({select: {sanityId: true, userId: true}}),
    db.savedOpportunity.findMany({select: {sanityId: true}}),
    db.order.findMany({where: {sanityOpportunityId: {not: null}}, select: {sanityOpportunityId: true, status: true, amountUsd: true}}),
    db.revenueEvent.findMany({select: {grossUsd: true, order: {select: {sanityOpportunityId: true}}}}),
  ])

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
  for (const o of orders) ordersBy.set(o.sanityOpportunityId!, (ordersBy.get(o.sanityOpportunityId!) ?? 0) + 1)
  const revenueBy = new Map<string, number>()
  for (const e of revenueEvents) {
    if (!e.order.sanityOpportunityId) continue
    revenueBy.set(e.order.sanityOpportunityId, (revenueBy.get(e.order.sanityOpportunityId) ?? 0) + e.grossUsd)
  }
  const metaBy = new Map(metas.map((m) => [m.sanityId, m]))

  // Include Sanity documents AND any DB-tracked ids missing from Sanity.
  const ids = new Set<string>([...sanityOps.map((o) => o._id), ...viewsBy.keys(), ...ordersBy.keys(), ...metas.map((m) => m.sanityId)])
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
  const [reports, metas] = await Promise.all([
    getAdminReports(),
    db.contentMeta.findMany({where: {contentType: 'report'}}),
  ])
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
  const staff = await db.user.findMany({
    where: {role: {in: ['advisor', 'admin']}},
    select: {id: true, email: true, fullName: true, role: true, status: true, lastLoginAt: true, createdAt: true, mfaEnabled: true},
    orderBy: {createdAt: 'asc'},
  })
  const profiles = await db.staffProfile.findMany()
  const profileBy = new Map(profiles.map((p) => [p.userId, p]))
  return staff.map((s) => ({
    ...s,
    adminRole: profileBy.get(s.id)?.adminRole ?? (s.role === 'admin' ? 'super_admin' : 'advisor'),
    hasStaffProfile: profileBy.has(s.id),
    title: profileBy.get(s.id)?.title ?? null,
    team: profileBy.get(s.id)?.team ?? null,
    isActive: profileBy.get(s.id)?.isActive ?? true,
  }))
}

export async function settingsData() {
  const [settings, staff] = await Promise.all([db.systemSetting.findMany({orderBy: {key: 'asc'}}), staffList()])

  const integrationStatus = [
    {key: 'smtp', label: 'Email (SMTP)', configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER), detail: process.env.SMTP_HOST ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? '587'}` : 'SMTP_HOST / SMTP_USER not set'},
    {key: 'sanity', label: 'Sanity CMS', configured: !!process.env.SANITY_PROJECT_ID && process.env.SANITY_PROJECT_ID !== 'your-project-id', detail: process.env.SANITY_PROJECT_ID ? `dataset: ${process.env.SANITY_DATASET || 'production'}` : 'SANITY_PROJECT_ID not set'},
    {key: 'payments', label: 'Payments (M-Pesa / wire / card)', configured: !!process.env.MPESA_SHORTCODE || !!process.env.PAYMENTS_MODE, detail: process.env.MPESA_SHORTCODE ? 'M-Pesa shortcode configured' : 'Manual verification mode (payments verified by staff)'},
    {key: 'auctions', label: 'Auctions (auctions.murivest.com)', configured: true, detail: 'Linked from opportunity records via auctionUrl'},
  ]

  return {settings, staff, integrationStatus}
}

export async function sessionsOverview() {
  const sessions = await db.session.findMany({
    orderBy: {lastSeenAt: 'desc'},
    take: 100,
    include: {user: {select: {id: true, email: true, fullName: true, role: true, status: true}}},
  })
  const securityEvents = await db.securityEvent.findMany({orderBy: {createdAt: 'desc'}, take: 50, include: {user: {select: {email: true, fullName: true}}}})
  return {sessions, securityEvents}
}

export async function auditViewer(opts: {actorId?: string; entity?: string; action?: string; search?: string; limit?: number} = {}) {
  const where: Record<string, unknown> = {}
  if (opts.actorId) where.actorId = opts.actorId
  if (opts.entity) where.entity = opts.entity
  if (opts.action) where.action = {contains: opts.action}

  let logs = await db.auditLog.findMany({
    where,
    orderBy: {createdAt: 'desc'},
    take: opts.limit ?? 150,
  })

  const search = opts.search?.trim().toLowerCase()
  if (search) {
    logs = logs.filter((l) => JSON.stringify(l.detail ?? {}).toLowerCase().includes(search) || l.action.toLowerCase().includes(search) || (l.entityId ?? '').toLowerCase().includes(search))
  }

  const actorIds = [...new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x))]
  const actors = actorIds.length ? await db.user.findMany({where: {id: {in: actorIds}}, select: {id: true, fullName: true, email: true, role: true}}) : []
  const actorBy = new Map(actors.map((a) => [a.id, a]))

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
    ? (await db.investorProfile.findMany({where: {advisorId: actx.auth.user.id}, select: {userId: true}})).map((p) => p.userId)
    : null

  const [revenue, pendingVerifications, openOrders, stalledMandates, openEnquiries, activity, paymentsToVerify, ordersToAssign, docRequestsPending, advisors] = await Promise.all([
    revenueCardMetrics(period),
    db.investorProfile.findMany({
      where: {...(scope ?? {}), OR: [{verificationStatus: {in: ['kyc_pending', 'in_review']}}, {kycStatus: {in: ['submitted', 'in_review']}}]},
      include: {user: {select: {email: true, fullName: true}}},
      orderBy: {updatedAt: 'asc'},
      take: 10,
    }),
    db.order.findMany({
      where: {status: {in: OPEN_STATUSES}, ...(assignedUserIds ? {userId: {in: assignedUserIds}} : {})},
      orderBy: [{priority: 'desc'}, {createdAt: 'asc'}],
      take: 10,
      include: {payments: {select: {status: true}}},
    }),
    db.mandate.findMany({
      where: {status: 'active', ...(assignedUserIds ? {OR: [{userId: {in: assignedUserIds}}, {advisorId: actx.auth.user.id}]} : {})},
      orderBy: {updatedAt: 'asc'},
      take: 10,
    }),
    db.enquiry.findMany({
      where: {status: 'open', ...(assignedUserIds ? {userId: {in: assignedUserIds}} : {})},
      orderBy: {createdAt: 'asc'},
      take: 10,
      include: {messages: {where: {senderType: {not: 'investor'}}, select: {id: true}}},
    }),
    db.auditLog.findMany({orderBy: {createdAt: 'desc'}, take: 20}),
    db.payment.count({where: {status: 'submitted'}}),
    db.order.count({where: {status: {in: ['payment_confirmed', 'processing']}, assignedToId: null}}),
    db.documentRequest.count({where: {status: 'submitted'}}),
    db.user.findMany({where: {role: {in: ['advisor', 'admin']}}, select: {id: true, fullName: true, email: true, role: true}}),
  ])

  const actorIds = [...new Set(activity.map((a) => a.actorId).filter((x): x is string => !!x))]
  const actors = actorIds.length ? await db.user.findMany({where: {id: {in: actorIds}}, select: {id: true, fullName: true, email: true}}) : []
  const actorBy = new Map(actors.map((a) => [a.id, a.fullName || a.email]))

  const now = Date.now()
  return {
    revenue,
    queues: {
      pendingVerifications: pendingVerifications.map((p) => ({
        userId: p.userId,
        name: p.user.fullName || p.user.email,
        email: p.user.email,
        verificationStatus: p.verificationStatus,
        kycStatus: p.kycStatus,
        accessTier: p.accessTier,
        waitingDays: Math.floor((now - p.createdAt.getTime()) / 86400000),
      })),
      openOrders: openOrders.map((o) => ({
        id: o.id,
        reference: o.reference,
        briefTitle: o.briefTitle,
        status: o.status,
        priority: o.priority,
        amountUsd: o.amountUsd,
        currency: o.currency,
        createdAt: o.createdAt,
        dueAt: o.dueAt,
        assigned: !!o.assignedToId,
        paid: o.payments.some((p) => p.status === 'verified'),
      })),
      stalledMandates: stalledMandates.map((m) => ({
        id: m.id,
        reference: m.reference,
        title: m.title,
        stage: m.stage,
        probability: m.probability,
        nextAction: m.nextAction,
        nextActionDue: m.nextActionDue,
        daysSinceUpdate: Math.floor((now - m.updatedAt.getTime()) / 86400000),
      })),
      openEnquiries: openEnquiries.map((e) => ({
        id: e.id,
        subject: e.subject,
        createdAt: e.createdAt,
        awaitingReply: e.messages.length === 0,
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
      newEnquiries: openEnquiries.length,
    },
    advisors: advisors.map((a) => ({id: a.id, name: a.fullName || a.email, role: a.role})),
  }
}

export {OPEN_STATUSES}
