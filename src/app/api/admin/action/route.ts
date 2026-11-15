import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {audit, notify, securityEvent} from '@/lib/auth/audit'
import {hashPassword, passwordPolicyError} from '@/lib/auth/password'
import {fail, clientMeta} from '@/lib/api'
import {requireAdminApi, isAdminResponse, orderTransitionAllowed, isValidAdminRole, type AdminContext, type Permission} from '@/lib/admin/rbac'
import {recogniseRevenue, applyRefundToLedger} from '@/lib/admin/revenue'

/**
 * Admin write API — one guarded dispatcher for every mutation in the Admin
 * Internal System. Pattern mirrors /api/staff (the investor-facing desk
 * endpoint) with granular RBAC: every action checks its permission key,
 * writes an OrderStatusEvent / compliance record where applicable, notifies
 * the affected investor, and is audit-logged.
 */
const schema = z.object({
  action: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

async function guard(permission?: Permission): Promise<{actx: AdminContext} | {response: NextResponse}> {
  return requireAdminApi(permission)
}

const str = (p: Record<string, unknown>, k: string) => (typeof p[k] === 'string' && (p[k] as string).length > 0 ? (p[k] as string) : undefined)
const strOrNull = (p: Record<string, unknown>, k: string) => (k in p ? (typeof p[k] === 'string' && (p[k] as string).length > 0 ? (p[k] as string) : null) : undefined)
const bool = (p: Record<string, unknown>, k: string) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : undefined)
const int = (p: Record<string, unknown>, k: string) => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? Math.trunc(p[k] as number) : undefined)

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Invalid request.')
  const {action} = parsed.data
  const p = (parsed.data.payload ?? {}) as Record<string, unknown>
  const meta = clientMeta(req)

  // --------------------------------------------------------------------------
  // Investors — verification, tiers, advisor assignment, freeze
  // --------------------------------------------------------------------------
  if (action === 'investor.update') {
    const g = await guard('investors.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const userId = str(p, 'userId')
    if (!userId) return fail('userId required.')
    const before = await db.investorProfile.findUnique({where: {userId}})
    if (!before) return fail('Investor not found.', 404)

    const data: Record<string, unknown> = {}
    for (const key of ['verificationStatus', 'kycStatus', 'amlStatus', 'accessTier', 'classification']) {
      const v = str(p, key)
      if (v) data[key] = v
    }
    if ('advisorId' in p) {
      const v = strOrNull(p, 'advisorId')
      if (v) {
        const advisor = await db.user.findUnique({where: {id: v}})
        if (!advisor || !['advisor', 'admin'].includes(advisor.role)) return fail('Advisor must be a staff member.')
      }
      data.advisorId = v
    }
    if ('ndaAccepted' in p) data.ndaAccepted = bool(p, 'ndaAccepted') ?? false
    if ('source' in p) data.source = strOrNull(p, 'source')
    if ('notes' in p) data.notes = strOrNull(p, 'notes')

    await db.investorProfile.update({where: {userId}, data: data as never})

    if (data.accessTier && data.accessTier !== before.accessTier) {
      await notify({userId, type: 'system', title: 'Access tier updated', body: `Your Murivest access tier is now ${(data.accessTier as string).replace('_', ' ')}. Sign in to review newly available material.`, link: '/portal'})
    }
    if (data.kycStatus === 'approved' && before.kycStatus !== 'approved') {
      await notify({userId, type: 'system', title: 'Verification approved', body: 'Your KYC verification is approved. Confidential opportunities and off-market material are now visible where permitted.', link: '/portal/discover'})
    }
    await db.complianceReview.create({
      data: {
        subjectUserId: userId,
        reviewerId: actx.auth.user.id,
        decision: 'note',
        notes: 'Profile fields updated',
        detail: {before: {verificationStatus: before.verificationStatus, kycStatus: before.kycStatus, amlStatus: before.amlStatus, accessTier: before.accessTier, advisorId: before.advisorId, ndaAccepted: before.ndaAccepted}, after: data} as never,
      },
    }).catch(() => {})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.investor_updated', entity: 'investor', entityId: userId, detail: data, ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'investor.freeze' || action === 'investor.unfreeze') {
    const g = await guard('investors.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const userId = str(p, 'userId')
    const reason = str(p, 'reason')
    if (!userId) return fail('userId required.')
    const target = await db.user.findUnique({where: {id: userId}})
    if (!target) return fail('Account not found.', 404)
    const status = action === 'investor.freeze' ? 'suspended' : 'active'
    await db.user.update({where: {id: userId}, data: {status: status as never}})
    if (action === 'investor.freeze') {
      await db.session.updateMany({where: {userId, revokedAt: null}, data: {revokedAt: new Date()}})
      await db.complianceReview.create({
        data: {subjectUserId: userId, reviewerId: actx.auth.user.id, decision: 'escalated', notes: reason ?? 'Account frozen', riskFlags: [{flag: 'account_frozen', severity: 'high'}] as never, detail: {status} as never},
      }).catch(() => {})
    }
    await securityEvent({userId, type: action === 'investor.freeze' ? 'account_locked' : 'login', ...meta, detail: {by: actx.auth.user.id, reason}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: `admin.${action.split('.')[1]}`, entity: 'user', entityId: userId, detail: {status, reason}, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Compliance review record (KYC/AML queue decisions)
  // --------------------------------------------------------------------------
  if (action === 'compliance.review') {
    const g = await guard('compliance.review')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const userId = str(p, 'userId')
    const decision = str(p, 'decision')
    if (!userId || !decision || !['approved', 'rejected', 'escalated', 'note'].includes(decision)) return fail('userId and a valid decision required.')
    const notes = str(p, 'notes')
    const riskFlags = Array.isArray(p.riskFlags) ? (p.riskFlags as unknown[]) : []

    const before = await db.investorProfile.findUnique({where: {userId}})
    await db.complianceReview.create({
      data: {subjectUserId: userId, reviewerId: actx.auth.user.id, decision: decision as never, notes: notes ?? null, riskFlags: riskFlags as never, detail: {before: before ? {verificationStatus: before.verificationStatus, kycStatus: before.kycStatus, amlStatus: before.amlStatus, accessTier: before.accessTier} : null} as never},
    })
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: `admin.compliance_${decision}`, entity: 'investor', entityId: userId, detail: {notes, riskFlags}, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Orders Engine — assignment, status lifecycle, priority, attribution
  // --------------------------------------------------------------------------
  if (action === 'order.assign') {
    const g = await guard('orders.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const orderId = str(p, 'orderId')
    if (!orderId) return fail('orderId required.')
    const order = await db.order.findUnique({where: {id: orderId}})
    if (!order) return fail('Order not found.', 404)
    const assignedToId = strOrNull(p, 'assignedToId')
    if (assignedToId) {
      const assignee = await db.user.findUnique({where: {id: assignedToId}})
      if (!assignee || !['advisor', 'admin'].includes(assignee.role)) return fail('Assignee must be a staff member.')
    }
    await db.order.update({where: {id: orderId}, data: {assignedToId}})
    if (assignedToId) {
      await notify({userId: assignedToId, type: 'system', title: `Order assigned — ${order.reference}`, body: `“${order.briefTitle}” has been assigned to you for fulfilment.`, link: `/admin/orders/${orderId}`})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.order_assigned', entity: 'order', entityId: orderId, detail: {assignedToId}, ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'order.status') {
    const g = await guard('orders.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const orderId = str(p, 'orderId')
    const status = str(p, 'status')
    const note = str(p, 'note')
    if (!orderId || !status) return fail('orderId and status required.')
    const order = await db.order.findUnique({where: {id: orderId}, include: {payments: true}})
    if (!order) return fail('Order not found.', 404)
    if (order.status === status) return fail('Order is already in that status.')
    if (!orderTransitionAllowed(order.status, status)) return fail(`Invalid transition: ${order.status} → ${status}.`)

    const data: Record<string, unknown> = {status}
    if (status === 'delivered') data.deliveredAt = new Date()
    if (status === 'closed') data.closedAt = new Date()
    if (status === 'cancelled') {
      data.cancelledAt = new Date()
      data.cancellationReason = note ?? 'Cancelled by Murivest'
    }
    const trackingNumber = str(p, 'trackingNumber')
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber
    const deliveryDocumentId = str(p, 'deliveryDocumentId')
    if (deliveryDocumentId !== undefined) data.deliveryDocumentId = deliveryDocumentId || null

    await db.order.update({where: {id: orderId}, data: data as never})
    await db.orderStatusEvent.create({data: {orderId, fromStatus: order.status, toStatus: status, changedById: actx.auth.user.id, note: note ?? null}})

    // Delivery: recognise revenue + release the brief into the investor's
    // secure data room when a Sanity document is attached.
    if (status === 'delivered') {
      await recogniseRevenue(orderId, actx.auth.user.id)
      const docId = (deliveryDocumentId ?? order.deliveryDocumentId) || null
      if (docId) {
        const existing = await db.documentGrant.findFirst({where: {sanityDocumentId: docId, userId: order.userId}})
        if (!existing) {
          await db.documentGrant.create({data: {sanityDocumentId: docId, userId: order.userId, grantedById: actx.auth.user.id, permission: 'download'}})
        }
        await notify({userId: order.userId, type: 'document', title: `Brief delivered — ${order.reference}`, body: `“${order.briefTitle}” has been delivered to your secure Document Room.`, link: '/portal/documents'})
      }
    }

    const statusLabel = status.replace(/_/g, ' ')
    await notify({
      userId: order.userId,
      type: 'order_status',
      title: `Order ${order.reference} · ${statusLabel}`,
      body:
        status === 'delivered'
          ? `“${order.briefTitle}” has been delivered${order.format === 'hard_copy' ? ' by courier' : ' to your Document Room'}.`
          : `Your order “${order.briefTitle}” is now ${statusLabel}.`,
      link: '/portal/orders',
    })
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.order_status', entity: 'order', entityId: orderId, detail: {from: order.status, to: status, note, deliveryDocumentId}, ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'order.update') {
    const g = await guard('orders.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const orderId = str(p, 'orderId')
    if (!orderId) return fail('orderId required.')
    const order = await db.order.findUnique({where: {id: orderId}})
    if (!order) return fail('Order not found.', 404)

    const data: Record<string, unknown> = {}
    const priority = str(p, 'priority')
    if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) data.priority = priority
    if ('dueAt' in p) {
      const v = str(p, 'dueAt')
      data.dueAt = v ? new Date(v) : null
    }
    if ('advisorId' in p) {
      const v = strOrNull(p, 'advisorId')
      if (v) {
        const advisor = await db.user.findUnique({where: {id: v}})
        if (!advisor || !['advisor', 'admin'].includes(advisor.role)) return fail('Advisor must be a staff member.')
      }
      data.advisorId = v
    }
    if ('trackingNumber' in p) data.trackingNumber = strOrNull(p, 'trackingNumber')
    if ('transactionId' in p) data.transactionId = strOrNull(p, 'transactionId')
    if (Object.keys(data).length === 0) return fail('No changes supplied.')

    await db.order.update({where: {id: orderId}, data: data as never})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.order_updated', entity: 'order', entityId: orderId, detail: data, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Payments — verification & reconciliation
  // --------------------------------------------------------------------------
  if (action === 'payment.verify') {
    const g = await guard('payments.verify')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const paymentId = str(p, 'paymentId')
    const decision = str(p, 'decision')
    const note = str(p, 'note')
    if (!paymentId || !decision || !['verified', 'rejected'].includes(decision)) return fail('paymentId and decision (verified|rejected) required.')
    const payment = await db.payment.findUnique({where: {id: paymentId}, include: {order: true}})
    if (!payment) return fail('Payment not found.', 404)

    await db.payment.update({where: {id: paymentId}, data: {status: decision as never, verifiedById: actx.auth.user.id, verifiedAt: new Date(), note: note ?? null}})

    if (decision === 'verified') {
      const order = payment.order
      if (['pending', 'awaiting_payment'].includes(order.status)) {
        await db.order.update({where: {id: order.id}, data: {status: 'payment_confirmed'}})
        await db.orderStatusEvent.create({data: {orderId: order.id, fromStatus: order.status, toStatus: 'payment_confirmed', changedById: actx.auth.user.id, note: 'Payment verified'}})
      }
      await notify({userId: payment.userId, type: 'order_status', title: 'Payment confirmed', body: `Payment for ${payment.order.reference} is confirmed. Preparation of “${payment.order.briefTitle}” will now be scheduled.`, link: '/portal/orders'})
    } else {
      await notify({userId: payment.userId, type: 'order_status', title: 'Payment could not be verified', body: `We could not verify the payment for ${payment.order.reference}. ${note || 'Please contact your advisor.'}`, link: '/portal/orders'})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.payment_verified', entity: 'payment', entityId: paymentId, detail: {decision, note}, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Refunds / adjustments (controlled)
  // --------------------------------------------------------------------------
  if (action === 'refund.propose') {
    const g = await guard('refunds.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const orderId = str(p, 'orderId')
    const reason = str(p, 'reason')
    const amountUsd = typeof p.amountUsd === 'number' ? (p.amountUsd as number) : undefined
    if (!orderId || !reason || !amountUsd || amountUsd <= 0) return fail('orderId, positive amountUsd and reason required.')
    const order = await db.order.findUnique({where: {id: orderId}})
    if (!order) return fail('Order not found.', 404)
    const refund = await db.refundAdjustment.create({data: {orderId, amountUsd, amountKes: typeof p.amountKes === 'number' ? (p.amountKes as number) : 0, reason, requestedById: actx.auth.user.id}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.refund_proposed', entity: 'order', entityId: orderId, detail: {refundId: refund.id, amountUsd, reason}, ...meta})
    return NextResponse.json({ok: true, refundId: refund.id})
  }

  if (action === 'refund.review') {
    const g = await guard('refunds.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const refundId = str(p, 'refundId')
    const decision = str(p, 'decision')
    if (!refundId || !decision || !['approved', 'rejected'].includes(decision)) return fail('refundId and decision (approved|rejected) required.')
    const refund = await db.refundAdjustment.findUnique({where: {id: refundId}, include: {order: true}})
    if (!refund) return fail('Refund not found.', 404)
    if (refund.status !== 'proposed') return fail('Only proposed refunds can be reviewed.')

    await db.refundAdjustment.update({where: {id: refundId}, data: {status: decision === 'approved' ? 'approved' : 'rejected', reviewedById: actx.auth.user.id, reviewedAt: new Date()}})
    if (decision === 'approved') {
      await applyRefundToLedger(refund.orderId, refund.amountUsd)
      await notify({userId: refund.order.userId, type: 'order_status', title: 'Refund approved', body: `A refund of $${refund.amountUsd.toLocaleString('en-GB')} has been approved for ${refund.order.reference}. ${refund.reason}`, link: '/portal/orders'})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: `admin.refund_${decision}`, entity: 'order', entityId: refund.orderId, detail: {refundId, amountUsd: refund.amountUsd}, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Mandates & pipeline
  // --------------------------------------------------------------------------
  if (action === 'mandate.update') {
    const g = await guard('mandates.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const mandateId = str(p, 'mandateId')
    if (!mandateId) return fail('mandateId required.')
    const mandate = await db.mandate.findUnique({where: {id: mandateId}})
    if (!mandate) return fail('Mandate not found.', 404)

    const data: Record<string, unknown> = {}
    const status = str(p, 'status')
    if (status && ['draft', 'submitted', 'active', 'paused', 'closed', 'rejected'].includes(status)) {
      data.status = status
      if (status === 'active' && !mandate.activatedAt) data.activatedAt = new Date()
      if (status === 'closed') data.closedAt = new Date()
    }
    const stage = str(p, 'stage')
    if (stage && ['sourcing', 'qualification', 'matching', 'negotiation', 'closing', 'post_closing'].includes(stage)) data.stage = stage
    const probability = int(p, 'probability')
    if (probability != null) data.probability = Math.min(100, Math.max(0, probability))
    if ('nextAction' in p) data.nextAction = strOrNull(p, 'nextAction')
    if ('nextActionDue' in p) {
      const v = str(p, 'nextActionDue')
      data.nextActionDue = v ? new Date(v) : null
    }
    if ('advisorId' in p) data.advisorId = strOrNull(p, 'advisorId')
    if (Object.keys(data).length === 0) return fail('No changes supplied.')

    await db.mandate.update({where: {id: mandateId}, data: data as never})
    if (data.status === 'active' && mandate.status !== 'active') {
      await notify({userId: mandate.userId, type: 'mandate', title: `Mandate ${mandate.reference} activated`, body: 'Your acquisition mandate is live. Matching opportunities will be surfaced in Discover and communicated by your advisor.', link: '/portal/mandates'})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.mandate_updated', entity: 'mandate', entityId: mandateId, detail: data, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Documents & data room
  // --------------------------------------------------------------------------
  if (action === 'document.grant') {
    const g = await guard('documents.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const sanityDocumentId = str(p, 'sanityDocumentId')
    const userId = str(p, 'userId')
    const organisationId = str(p, 'organisationId')
    const permission = str(p, 'permission') ?? 'view'
    const expiresAt = str(p, 'expiresAt')
    if (!sanityDocumentId || (!userId && !organisationId)) return fail('sanityDocumentId and userId or organisationId required.')
    const existing = await db.documentGrant.findFirst({where: {sanityDocumentId, userId: userId ?? null, organisationId: organisationId ?? null}})
    if (existing) {
      await db.documentGrant.update({where: {id: existing.id}, data: {permission: permission as never, expiresAt: expiresAt ? new Date(expiresAt) : null}})
    } else {
      await db.documentGrant.create({data: {sanityDocumentId, userId: userId || null, organisationId: organisationId || null, grantedById: actx.auth.user.id, permission: permission as never, expiresAt: expiresAt ? new Date(expiresAt) : null}})
    }
    if (userId) {
      await notify({userId, type: 'document', title: 'Document access granted', body: 'A document has been shared with you in the secure Document Room.', link: '/portal/documents'})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.document_granted', entity: 'document', entityId: sanityDocumentId, detail: {userId, organisationId, permission, expiresAt}, ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'document.revoke') {
    const g = await guard('documents.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const grantId = str(p, 'grantId')
    if (!grantId) return fail('grantId required.')
    const grant = await db.documentGrant.findUnique({where: {id: grantId}})
    if (!grant) return fail('Grant not found.', 404)
    await db.documentGrant.delete({where: {id: grantId}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.document_revoked', entity: 'document', entityId: grant.sanityDocumentId, detail: {userId: grant.userId, organisationId: grant.organisationId}, ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'document.requestStatus') {
    const g = await guard('documents.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const requestId = str(p, 'requestId')
    const status = str(p, 'status')
    if (!requestId || !status || !['submitted', 'in_review', 'ready', 'declined'].includes(status)) return fail('requestId and a valid status required.')
    const request = await db.documentRequest.findUnique({where: {id: requestId}})
    if (!request) return fail('Request not found.', 404)
    await db.documentRequest.update({where: {id: requestId}, data: {status: status as never}})
    if (status === 'ready') {
      await notify({userId: request.userId, type: 'document', title: 'Requested materials are ready', body: 'Your document request has been fulfilled — see the secure Document Room.', link: '/portal/documents'})
    } else if (status === 'declined') {
      await notify({userId: request.userId, type: 'document', title: 'Document request update', body: 'Your document request could not be fulfilled at this time. Your advisor will explain the alternatives.', link: '/portal/documents'})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.doc_request_status', entity: 'document_request', entityId: requestId, detail: {status}, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Content governance (opportunities / briefs / documents / reports)
  // --------------------------------------------------------------------------
  if (action === 'content.upsertMeta') {
    const contentType = str(p, 'contentType')
    const sanityId = str(p, 'sanityId')
    if (!contentType || !sanityId || !['opportunity', 'brief', 'document', 'report'].includes(contentType)) return fail('contentType and sanityId required.')
    const perm: Permission = contentType === 'report' ? 'intelligence.manage' : contentType === 'document' ? 'documents.manage' : 'opportunities.manage'
    const g = await guard(perm)
    if (isAdminResponse(g)) return g.response
    const {actx} = g

    const data: Record<string, unknown> = {}
    const status = str(p, 'status')
    if (status && ['live', 'paused', 'archived'].includes(status)) data.status = status
    const visibilityTier = str(p, 'visibilityTier')
    if (visibilityTier && ['tier_1', 'tier_2', 'tier_3'].includes(visibilityTier)) data.visibilityTier = visibilityTier
    if ('featured' in p) data.featured = bool(p, 'featured') ?? false
    if ('tags' in p && Array.isArray(p.tags)) data.tags = p.tags
    if ('notes' in p) data.notes = strOrNull(p, 'notes')
    if ('title' in p) data.title = strOrNull(p, 'title')
    if (Object.keys(data).length === 0) return fail('No changes supplied.')
    data.updatedById = actx.auth.user.id

    const existing = await db.contentMeta.findUnique({where: {contentType_sanityId: {contentType, sanityId}}})
    if (existing) {
      await db.contentMeta.update({where: {id: existing.id}, data: data as never})
    } else {
      await db.contentMeta.create({data: {contentType, sanityId, ...(data as never)}})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.content_meta_upserted', entity: contentType, entityId: sanityId, detail: data, ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'content.bulkMeta') {
    const contentType = str(p, 'contentType')
    const ids = Array.isArray(p.sanityIds) ? (p.sanityIds as string[]) : []
    if (!contentType || ids.length === 0) return fail('contentType and sanityIds[] required.')
    const perm: Permission = contentType === 'report' ? 'intelligence.manage' : contentType === 'document' ? 'documents.manage' : 'opportunities.manage'
    const g = await guard(perm)
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const status = str(p, 'status')
    if (!status || !['live', 'paused', 'archived'].includes(status)) return fail('A valid status required.')
    let count = 0
    for (const sanityId of ids.slice(0, 200)) {
      const existing = await db.contentMeta.findUnique({where: {contentType_sanityId: {contentType, sanityId}}})
      if (existing) {
        await db.contentMeta.update({where: {id: existing.id}, data: {status: status as never, updatedById: actx.auth.user.id}})
      } else {
        await db.contentMeta.create({data: {contentType, sanityId, status: status as never, updatedById: actx.auth.user.id}})
      }
      count += 1
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.content_bulk_status', entity: contentType, entityId: null, detail: {count, status, ids}, ...meta})
    return NextResponse.json({ok: true, count})
  }

  // --------------------------------------------------------------------------
  // Communications
  // --------------------------------------------------------------------------
  if (action === 'message.reply') {
    const g = await guard('communications.reply')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const enquiryId = str(p, 'enquiryId')
    const body = str(p, 'body')
    if (!enquiryId || !body) return fail('enquiryId and body required.')
    const thread = await db.enquiry.findUnique({where: {id: enquiryId}})
    if (!thread) return fail('Thread not found.', 404)
    if (actx.advisorId) {
      const profile = await db.investorProfile.findUnique({where: {userId: thread.userId}})
      if (profile?.advisorId !== actx.auth.user.id) return fail('This investor is not assigned to you.', 403)
    }
    await db.message.create({data: {userId: thread.userId, senderType: 'advisor', senderId: actx.auth.user.id, enquiryId, body}})
    await db.enquiry.update({where: {id: enquiryId}, data: {status: 'responded'}})
    await notify({userId: thread.userId, type: 'message', title: 'Reply from your Murivest advisor', body: body.slice(0, 120), link: '/portal/activity'})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.message_replied', entity: 'enquiry', entityId: enquiryId, ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'enquiry.close') {
    const g = await guard('communications.reply')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const enquiryId = str(p, 'enquiryId')
    if (!enquiryId) return fail('enquiryId required.')
    const thread = await db.enquiry.findUnique({where: {id: enquiryId}})
    if (!thread) return fail('Thread not found.', 404)
    await db.enquiry.update({where: {id: enquiryId}, data: {status: 'closed'}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.enquiry_closed', entity: 'enquiry', entityId: enquiryId, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Internal notes (any entity)
  // --------------------------------------------------------------------------
  if (action === 'note.create') {
    const g = await guard()
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const entityType = str(p, 'entityType')
    const entityId = str(p, 'entityId')
    const body = str(p, 'body')
    const visibility = str(p, 'visibility') ?? 'staff'
    if (!entityType || !entityId || !body) return fail('entityType, entityId and body required.')
    if (!['staff', 'admins'].includes(visibility)) return fail('Invalid visibility.')
    if (visibility === 'admins' && actx.role !== 'super_admin') return fail('Only super administrators may post admin-only notes.', 403)
    await db.internalNote.create({data: {entityType, entityId, authorId: actx.auth.user.id, body, visibility: visibility as never}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.note_created', entity: entityType, entityId, detail: {visibility}, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Broadcast notifications
  // --------------------------------------------------------------------------
  if (action === 'broadcast.notify') {
    const g = await guard('broadcast.send')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const audience = str(p, 'audience') ?? 'all'
    const title = str(p, 'title')
    const body = str(p, 'body')
    const link = str(p, 'link')
    if (!title || !body) return fail('title and body required.')

    let where: Record<string, unknown> = {role: 'investor', status: 'active'}
    if (audience === 'verified') where = {...where, profile: {verificationStatus: 'verified'}}
    else if (audience.startsWith('tier_')) where = {...where, profile: {accessTier: audience}}

    const investors = await db.user.findMany({where: where as never, select: {id: true}})
    for (const inv of investors) {
      await notify({userId: inv.id, type: 'system', title, body, link: link ?? '/portal'})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.broadcast_sent', entity: 'notification', entityId: null, detail: {audience, title, recipients: investors.length}, ...meta})
    return NextResponse.json({ok: true, recipients: investors.length})
  }

  // --------------------------------------------------------------------------
  // Staff management
  // --------------------------------------------------------------------------
  if (action === 'staff.create') {
    const g = await guard('staff.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const email = str(p, 'email')
    const fullName = str(p, 'fullName')
    const password = str(p, 'password')
    const adminRole = str(p, 'adminRole') ?? 'advisor'
    if (!email || !fullName || !password) return fail('email, fullName and password required.')
    if (!isValidAdminRole(adminRole)) return fail('Invalid admin role.')
    const policy = passwordPolicyError(password)
    if (policy) return fail(policy)
    if (await db.user.findUnique({where: {email: email.toLowerCase()}})) return fail('An account with this email already exists.', 409)

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        fullName,
        passwordHash: await hashPassword(password),
        role: adminRole === 'advisor' ? 'advisor' : 'admin',
        emailVerifiedAt: new Date(),
      },
    })
    await db.staffProfile.create({data: {userId: user.id, adminRole, title: str(p, 'title') ?? null, team: str(p, 'team') ?? null}})
    await securityEvent({userId: user.id, type: 'login', ...meta, detail: {created: adminRole}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.staff_created', entity: 'user', entityId: user.id, detail: {email, adminRole}, ...meta})
    return NextResponse.json({ok: true, userId: user.id})
  }

  if (action === 'staff.update') {
    const g = await guard('staff.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const userId = str(p, 'userId')
    if (!userId) return fail('userId required.')
    const target = await db.user.findUnique({where: {id: userId}, include: {profile: true}})
    if (!target || !['advisor', 'admin'].includes(target.role)) return fail('Staff member not found.', 404)
    if (target.profile) return fail('This account belongs to an investor, not staff.', 400)

    const data: Record<string, unknown> = {}
    const adminRole = str(p, 'adminRole')
    if (adminRole) {
      if (!isValidAdminRole(adminRole)) return fail('Invalid admin role.')
      data.adminRole = adminRole
    }
    if ('title' in p) data.title = strOrNull(p, 'title')
    if ('team' in p) data.team = strOrNull(p, 'team')
    if ('isActive' in p) data.isActive = bool(p, 'isActive') ?? true
    if (Object.keys(data).length === 0) return fail('No changes supplied.')

    const profile = await db.staffProfile.findUnique({where: {userId}})
    if (profile) {
      await db.staffProfile.update({where: {userId}, data: data as never})
      if (data.adminRole) {
        await db.user.update({where: {id: userId}, data: {role: data.adminRole === 'advisor' ? 'advisor' : 'admin'}})
      }
    } else {
      await db.staffProfile.create({data: {userId, adminRole: (data.adminRole as string) ?? (target.role === 'admin' ? 'super_admin' : 'advisor'), title: (data.title as string) ?? null, team: (data.team as string) ?? null, isActive: (data.isActive as boolean) ?? true}})
    }
    // Deactivated staff lose their sessions immediately.
    if (data.isActive === false) {
      await db.session.updateMany({where: {userId, revokedAt: null}, data: {revokedAt: new Date()}})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.staff_updated', entity: 'user', entityId: userId, detail: data, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // System settings (feature flags / integration values)
  // --------------------------------------------------------------------------
  if (action === 'setting.upsert') {
    const g = await guard('settings.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const key = str(p, 'key')
    if (!key) return fail('key required.')
    const category = str(p, 'category') ?? 'general'
    if (!['general', 'feature_flag', 'integration'].includes(category)) return fail('Invalid category.')
    const description = str(p, 'description')
    const value = ('value' in p ? p.value : undefined) ?? null

    const existing = await db.systemSetting.findUnique({where: {key}})
    if (existing) {
      await db.systemSetting.update({where: {id: existing.id}, data: {value: value as never, category: category as never, description: description ?? existing.description ?? null, updatedById: actx.auth.user.id}})
    } else {
      await db.systemSetting.create({data: {key, value: value as never, category: category as never, description: description ?? null, updatedById: actx.auth.user.id}})
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.setting_upserted', entity: 'setting', entityId: key, detail: {value, category}, ...meta})
    return NextResponse.json({ok: true})
  }

  // --------------------------------------------------------------------------
  // Session & security
  // --------------------------------------------------------------------------
  if (action === 'session.revoke') {
    const g = await guard('security.revoke')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const sessionId = str(p, 'sessionId')
    if (!sessionId) return fail('sessionId required.')
    const session = await db.session.findUnique({where: {id: sessionId}})
    if (!session) return fail('Session not found.', 404)
    await db.session.update({where: {id: sessionId}, data: {revokedAt: new Date()}})
    await securityEvent({userId: session.userId, type: 'session_revoked', ...meta, detail: {by: actx.auth.user.id}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.session_revoked', entity: 'session', entityId: sessionId, detail: {user: session.userId}, ...meta})
    return NextResponse.json({ok: true})
  }

  return fail('Unknown action.')
}
