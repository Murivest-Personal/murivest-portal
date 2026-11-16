import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, toCamel, toSnake, nowIso, newId} from '@/lib/supabase'
import {audit, notify, securityEvent} from '@/lib/auth/audit'
import {hashPassword, passwordPolicyError} from '@/lib/auth/password'
import {fail, clientMeta} from '@/lib/api'
import {requireAdminApi, isAdminResponse, orderTransitionAllowed, isValidAdminRole, type AdminContext, type Permission} from '@/lib/admin/rbac'
import {recogniseRevenue, applyRefundToLedger} from '@/lib/admin/revenue'
import {dispatchAnnouncement} from '@/lib/notifications/dispatch'
import type {
  ContentMetaRow,
  DocumentGrantRow,
  DocumentRequestRow,
  EnquiryRow,
  InvestorProfileRow,
  MandateRow,
  OrderRow,
  PaymentRow,
  RefundAdjustmentRow,
  SessionRow,
  StaffProfileRow,
  SystemSettingRow,
  UserRow,
} from '@/lib/db-types'

/**
 * Admin write API — one guarded dispatcher for every mutation in the Admin
 * Internal System. Pattern mirrors /api/staff (the investor-facing desk
 * endpoint) with granular RBAC: every action checks its permission key,
 * writes an OrderStatusEvent / compliance record where applicable, notifies
 * the affected investor, and is audit-logged.
 *
 * Storage: Supabase service-role client (@/lib/supabase) — snake_case at the
 * DB boundary, camelCase in the business logic below (toCamel/toSnake).
 * Prisma relation `include`s are separate follow-up queries + JS joins.
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
    const beforeRow = unwrapNullable<InvestorProfileRow>(
      await supabase.from('investor_profiles').select('*').eq('user_id', userId).maybeSingle(),
      'investor_profiles.get',
    )
    if (!beforeRow) return fail('Investor not found.', 404)
    const before = toCamel(beforeRow)

    const data: Record<string, unknown> = {}
    for (const key of ['verificationStatus', 'kycStatus', 'amlStatus', 'accessTier', 'classification']) {
      const v = str(p, key)
      if (v) data[key] = v
    }
    if ('advisorId' in p) {
      const v = strOrNull(p, 'advisorId')
      if (v) {
        const advisorRow = unwrapNullable<UserRow>(
          await supabase.from('users').select('*').eq('id', v).maybeSingle(),
          'users.get',
        )
        if (!advisorRow || !['advisor', 'admin'].includes(advisorRow.role)) return fail('Advisor must be a staff member.')
      }
      data.advisorId = v
    }
    if ('ndaAccepted' in p) data.ndaAccepted = bool(p, 'ndaAccepted') ?? false
    if ('source' in p) data.source = strOrNull(p, 'source')
    if ('notes' in p) data.notes = strOrNull(p, 'notes')

    // Empty PATCH bodies are rejected by PostgREST — skip the no-op write.
    // updated_at is maintained by the DB trigger — not set here.
    if (Object.keys(data).length > 0) {
      unwrap<null>(
        await supabase.from('investor_profiles').update(toSnake(data)).eq('user_id', userId),
        'investor_profiles.update',
      )
    }

    if (data.accessTier && data.accessTier !== before.accessTier) {
      await notify({userId, type: 'system', event: 'security.tier_changed', title: 'Access tier updated', body: `Your Murivest access tier is now ${(data.accessTier as string).replace('_', ' ')}. Sign in to review newly available material.`, link: '/portal', emailVars: {alertTitle: 'Access tier updated', alertDetail: `Your Murivest access tier is now ${(data.accessTier as string).replace('_', ' ')}. Newly available material can be reviewed when you next sign in.`}})
    }
    if (data.kycStatus === 'approved' && before.kycStatus !== 'approved') {
      await notify({userId, type: 'system', event: 'security.verification_update', title: 'Verification approved', body: 'Your KYC verification is approved. Confidential opportunities and off-market material are now visible where permitted.', link: '/portal/discover', emailVars: {alertTitle: 'Verification approved', alertDetail: 'Your KYC verification is approved. Confidential opportunities and off-market material are now visible where permitted.'}})
    }
    // best-effort compliance snapshot (was .catch(() => {}) in Prisma)
    await supabase.from('compliance_reviews').insert({
      id: newId(),
      subject_user_id: userId,
      reviewer_id: actx.auth.user.id,
      decision: 'note',
      notes: 'Profile fields updated',
      detail: {before: {verificationStatus: before.verificationStatus, kycStatus: before.kycStatus, amlStatus: before.amlStatus, accessTier: before.accessTier, advisorId: before.advisorId, ndaAccepted: before.ndaAccepted}, after: data},
      created_at: nowIso(),
    }).then(() => undefined, () => undefined)
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
    const targetRow = unwrapNullable<UserRow>(
      await supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      'users.get',
    )
    if (!targetRow) return fail('Account not found.', 404)
    const status = action === 'investor.freeze' ? 'suspended' : 'active'
    unwrap<null>(await supabase.from('users').update({status}).eq('id', userId), 'users.update')
    if (action === 'investor.freeze') {
      // updateMany → filtered update: revoke every live session
      unwrap<null>(
        await supabase.from('sessions').update({revoked_at: nowIso()}).eq('user_id', userId).is('revoked_at', null),
        'sessions.revokeAll',
      )
      // best-effort compliance record (was .catch(() => {}) in Prisma)
      await supabase.from('compliance_reviews').insert({
        id: newId(),
        subject_user_id: userId,
        reviewer_id: actx.auth.user.id,
        decision: 'escalated',
        notes: reason ?? 'Account frozen',
        risk_flags: [{flag: 'account_frozen', severity: 'high'}],
        detail: {status},
        created_at: nowIso(),
      }).then(() => undefined, () => undefined)
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

    const beforeRow = unwrapNullable<InvestorProfileRow>(
      await supabase.from('investor_profiles').select('*').eq('user_id', userId).maybeSingle(),
      'investor_profiles.get',
    )
    const before = beforeRow ? toCamel(beforeRow) : null
    unwrap<null>(
      await supabase.from('compliance_reviews').insert({
        id: newId(),
        subject_user_id: userId,
        reviewer_id: actx.auth.user.id,
        decision,
        notes: notes ?? null,
        risk_flags: riskFlags,
        detail: {before: before ? {verificationStatus: before.verificationStatus, kycStatus: before.kycStatus, amlStatus: before.amlStatus, accessTier: before.accessTier} : null},
        created_at: nowIso(),
      }),
      'compliance_reviews.create',
    )
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
    const orderRow = unwrapNullable<OrderRow>(
      await supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
      'orders.get',
    )
    if (!orderRow) return fail('Order not found.', 404)
    const order = toCamel(orderRow)
    const assignedToId = strOrNull(p, 'assignedToId')
    if (assignedToId) {
      const assigneeRow = unwrapNullable<UserRow>(
        await supabase.from('users').select('*').eq('id', assignedToId).maybeSingle(),
        'users.get',
      )
      if (!assigneeRow || !['advisor', 'admin'].includes(assigneeRow.role)) return fail('Assignee must be a staff member.')
    }
    // undefined ⇒ "leave unchanged" (Prisma semantics); null ⇒ unassign
    if (assignedToId !== undefined) {
      // updated_at is maintained by the DB trigger — not set here.
      unwrap<null>(
        await supabase.from('orders').update({assigned_to_id: assignedToId}).eq('id', orderId),
        'orders.update',
      )
    }
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
    const orderRow = unwrapNullable<OrderRow>(
      await supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
      'orders.get',
    )
    if (!orderRow) return fail('Order not found.', 404)
    const order = toCamel(orderRow)
    if (order.status === status) return fail('Order is already in that status.')
    if (!orderTransitionAllowed(order.status, status)) return fail(`Invalid transition: ${order.status} → ${status}.`)

    const data: Record<string, unknown> = {status}
    if (status === 'delivered') data.delivered_at = nowIso()
    if (status === 'closed') data.closed_at = nowIso()
    if (status === 'cancelled') {
      data.cancelled_at = nowIso()
      data.cancellation_reason = note ?? 'Cancelled by Murivest'
    }
    const trackingNumber = str(p, 'trackingNumber')
    if (trackingNumber !== undefined) data.tracking_number = trackingNumber
    const deliveryDocumentId = str(p, 'deliveryDocumentId')
    if (deliveryDocumentId !== undefined) data.delivery_document_id = deliveryDocumentId || null

    // NOTE: sequential (no multi-table tx over PostgREST) — order row, then status event.
    // updated_at is maintained by the DB trigger — not set here.
    unwrap<null>(await supabase.from('orders').update(data).eq('id', orderId), 'orders.update')
    unwrap<null>(
      await supabase.from('order_status_events').insert({
        id: newId(),
        order_id: orderId,
        from_status: order.status,
        to_status: status,
        changed_by_id: actx.auth.user.id,
        note: note ?? null,
        created_at: nowIso(),
      }),
      'order_status_events.create',
    )

    // Delivery: recognise revenue + release the brief into the investor's
    // secure data room when a Sanity document is attached.
    if (status === 'delivered') {
      await recogniseRevenue(orderId, actx.auth.user.id)
      const docId = (deliveryDocumentId ?? order.deliveryDocumentId) || null
      if (docId) {
        const existing = unwrapNullable<DocumentGrantRow>(
          await supabase.from('document_grants').select('*').eq('sanity_document_id', docId).eq('user_id', order.userId).maybeSingle(),
          'document_grants.find',
        )
        if (!existing) {
          unwrap<null>(
            await supabase.from('document_grants').insert({
              id: newId(),
              sanity_document_id: docId,
              user_id: order.userId,
              granted_by_id: actx.auth.user.id,
              permission: 'download',
              created_at: nowIso(),
            }),
            'document_grants.create',
          )
        }
      }
    }

    const statusLabel = status.replace(/_/g, ' ')
    const event =
      status === 'delivered' ? 'order.delivered'
      : status === 'payment_confirmed' ? 'order.payment_confirmed'
      : status === 'processing' ? 'order.in_progress'
      : status === 'ready' ? 'order.ready'
      : 'order.status_change'
    await notify({
      userId: order.userId,
      type: 'order_status',
      event,
      priority: ['delivered', 'ready', 'payment_confirmed'].includes(status) ? 'high' : 'normal',
      title: `Order ${order.reference} · ${statusLabel}`,
      body:
        status === 'delivered'
          ? `“${order.briefTitle}” has been delivered${order.format === 'hard_copy' ? ' by courier' : ' to your Document Room'}.`
          : `Your order “${order.briefTitle}” is now ${statusLabel}.`,
      link: status === 'delivered' ? '/portal/documents' : '/portal/orders',
      dedupeKey: `order.${order.id}.${status}`,
      emailVars: {
        briefTitle: order.briefTitle,
        orderRef: order.reference,
        statusLabel: statusLabel.replace(/^\w/, (c) => c.toUpperCase()),
        statusNote:
          status === 'delivered'
            ? 'The brief is in your secure Document Room, watermarked for your account.'
            : `Your order “${order.briefTitle}” is now ${statusLabel}.`,
      },
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
    const orderRow = unwrapNullable<OrderRow>(
      await supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
      'orders.get',
    )
    if (!orderRow) return fail('Order not found.', 404)

    const data: Record<string, unknown> = {}
    const priority = str(p, 'priority')
    if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) data.priority = priority
    if ('dueAt' in p) {
      const v = str(p, 'dueAt')
      data.dueAt = v ? new Date(v).toISOString() : null
    }
    if ('advisorId' in p) {
      const v = strOrNull(p, 'advisorId')
      if (v) {
        const advisorRow = unwrapNullable<UserRow>(
          await supabase.from('users').select('*').eq('id', v).maybeSingle(),
          'users.get',
        )
        if (!advisorRow || !['advisor', 'admin'].includes(advisorRow.role)) return fail('Advisor must be a staff member.')
      }
      data.advisorId = v
    }
    if ('trackingNumber' in p) data.trackingNumber = strOrNull(p, 'trackingNumber')
    if ('transactionId' in p) data.transactionId = strOrNull(p, 'transactionId')
    if (Object.keys(data).length === 0) return fail('No changes supplied.')

    // updated_at is maintained by the DB trigger — not set here.
    unwrap<null>(await supabase.from('orders').update(toSnake(data)).eq('id', orderId), 'orders.update')
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
    const paymentRow = unwrapNullable<PaymentRow>(
      await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle(),
      'payments.get',
    )
    if (!paymentRow) return fail('Payment not found.', 404)
    const payment = toCamel(paymentRow)

    unwrap<null>(
      await supabase.from('payments').update({
        status: decision,
        verified_by_id: actx.auth.user.id,
        verified_at: nowIso(),
        note: note ?? null,
      }).eq('id', paymentId),
      'payments.update',
    )

    // Prisma include {order: true} → separate follow-up query (FK-backed).
    const orderRow = unwrapNullable<OrderRow>(
      await supabase.from('orders').select('*').eq('id', paymentRow.order_id).maybeSingle(),
      'orders.get',
    )
    const order = toCamel(orderRow!)

    if (decision === 'verified') {
      if (['pending', 'awaiting_payment'].includes(order.status)) {
        // NOTE: sequential (no multi-table tx over PostgREST).
        unwrap<null>(
          await supabase.from('orders').update({status: 'payment_confirmed'}).eq('id', order.id),
          'orders.update',
        )
        unwrap<null>(
          await supabase.from('order_status_events').insert({
            id: newId(),
            order_id: order.id,
            from_status: order.status,
            to_status: 'payment_confirmed',
            changed_by_id: actx.auth.user.id,
            note: 'Payment verified',
            created_at: nowIso(),
          }),
          'order_status_events.create',
        )
      }
      await notify({userId: payment.userId, type: 'order_status', event: 'order.payment_confirmed', title: 'Payment confirmed', body: `Payment for ${order.reference} is confirmed. Preparation of “${order.briefTitle}” will now be scheduled.`, link: '/portal/orders', emailVars: {briefTitle: order.briefTitle, orderRef: order.reference, statusLabel: 'Payment confirmed', statusNote: `Payment for ${order.reference} is confirmed. Preparation of “${order.briefTitle}” will now be scheduled.`}})
    } else {
      await notify({userId: payment.userId, type: 'order_status', event: 'order.payment_issue', title: 'Payment could not be verified', body: `We could not verify the payment for ${order.reference}. ${note || 'Please contact your advisor.'}`, link: '/portal/orders', emailVars: {briefTitle: order.briefTitle, orderRef: order.reference, statusLabel: 'Payment could not be verified', statusNote: `We could not verify the payment for ${order.reference}. ${note || 'Please contact your advisor.'}`}})
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
    const orderRow = unwrapNullable<OrderRow>(
      await supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
      'orders.get',
    )
    if (!orderRow) return fail('Order not found.', 404)
    const refundId = newId()
    unwrap<null>(
      await supabase.from('refund_adjustments').insert({
        id: refundId,
        order_id: orderId,
        amount_usd: amountUsd,
        amount_kes: typeof p.amountKes === 'number' ? (p.amountKes as number) : 0,
        reason,
        requested_by_id: actx.auth.user.id,
        created_at: nowIso(),
      }),
      'refund_adjustments.create',
    )
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.refund_proposed', entity: 'order', entityId: orderId, detail: {refundId, amountUsd, reason}, ...meta})
    return NextResponse.json({ok: true, refundId})
  }

  if (action === 'refund.review') {
    const g = await guard('refunds.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const refundId = str(p, 'refundId')
    const decision = str(p, 'decision')
    if (!refundId || !decision || !['approved', 'rejected'].includes(decision)) return fail('refundId and decision (approved|rejected) required.')
    const refundRow = unwrapNullable<RefundAdjustmentRow>(
      await supabase.from('refund_adjustments').select('*').eq('id', refundId).maybeSingle(),
      'refund_adjustments.get',
    )
    if (!refundRow) return fail('Refund not found.', 404)
    const refund = toCamel(refundRow)
    if (refund.status !== 'proposed') return fail('Only proposed refunds can be reviewed.')

    unwrap<null>(
      await supabase.from('refund_adjustments').update({
        status: decision === 'approved' ? 'approved' : 'rejected',
        reviewed_by_id: actx.auth.user.id,
        reviewed_at: nowIso(),
      }).eq('id', refundId),
      'refund_adjustments.update',
    )
    if (decision === 'approved') {
      await applyRefundToLedger(refund.orderId, refund.amountUsd)
      // Prisma include {order: true} → separate follow-up query (FK-backed).
      const orderRow = unwrapNullable<OrderRow>(
        await supabase.from('orders').select('*').eq('id', refundRow.order_id).maybeSingle(),
        'orders.get',
      )
      const order = toCamel(orderRow!)
      await notify({userId: order.userId, type: 'order_status', event: 'order.refund', title: 'Refund approved', body: `A refund of $${refund.amountUsd.toLocaleString('en-GB')} has been approved for ${order.reference}. ${refund.reason}`, link: '/portal/orders', emailVars: {briefTitle: order.briefTitle, orderRef: order.reference, statusLabel: 'Refund approved', statusNote: `A refund of $${refund.amountUsd.toLocaleString('en-GB')} has been approved for ${order.reference}. ${refund.reason}`}})
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
    const mandateRow = unwrapNullable<MandateRow>(
      await supabase.from('mandates').select('*').eq('id', mandateId).maybeSingle(),
      'mandates.get',
    )
    if (!mandateRow) return fail('Mandate not found.', 404)
    const mandate = toCamel(mandateRow)

    const data: Record<string, unknown> = {}
    const status = str(p, 'status')
    if (status && ['draft', 'submitted', 'active', 'paused', 'closed', 'rejected'].includes(status)) {
      data.status = status
      if (status === 'active' && !mandate.activatedAt) data.activatedAt = nowIso()
      if (status === 'closed') data.closedAt = nowIso()
    }
    const stage = str(p, 'stage')
    if (stage && ['sourcing', 'qualification', 'matching', 'negotiation', 'closing', 'post_closing'].includes(stage)) data.stage = stage
    const probability = int(p, 'probability')
    if (probability != null) data.probability = Math.min(100, Math.max(0, probability))
    if ('nextAction' in p) data.nextAction = strOrNull(p, 'nextAction')
    if ('nextActionDue' in p) {
      const v = str(p, 'nextActionDue')
      data.nextActionDue = v ? new Date(v).toISOString() : null
    }
    if ('advisorId' in p) data.advisorId = strOrNull(p, 'advisorId')
    if (Object.keys(data).length === 0) return fail('No changes supplied.')

    // updated_at is maintained by the DB trigger — not set here.
    unwrap<null>(await supabase.from('mandates').update(toSnake(data)).eq('id', mandateId), 'mandates.update')
    if (data.status === 'active' && mandate.status !== 'active') {
      await notify({userId: mandate.userId, type: 'mandate', event: 'mandate.status', title: `Mandate ${mandate.reference} activated`, body: 'Your acquisition mandate is live. Matching opportunities will be surfaced in Discover and communicated by your advisor.', link: '/portal/mandates', emailVars: {mandateRef: mandate.reference, mandateTitle: mandate.title, mandateStatus: 'activated', mandateNote: 'Your acquisition mandate is live. Matching opportunities will be surfaced in Discover and communicated by your advisor.'}})
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
    // findFirst({sanityDocumentId, userId: userId ?? null, organisationId: organisationId ?? null})
    let grantQuery = supabase.from('document_grants').select('*').eq('sanity_document_id', sanityDocumentId)
    grantQuery = userId ? grantQuery.eq('user_id', userId) : grantQuery.is('user_id', null)
    grantQuery = organisationId ? grantQuery.eq('organisation_id', organisationId) : grantQuery.is('organisation_id', null)
    const existing = unwrapNullable<DocumentGrantRow>(await grantQuery.maybeSingle(), 'document_grants.find')
    if (existing) {
      unwrap<null>(
        await supabase.from('document_grants').update({
          permission,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        }).eq('id', existing.id),
        'document_grants.update',
      )
    } else {
      unwrap<null>(
        await supabase.from('document_grants').insert({
          id: newId(),
          sanity_document_id: sanityDocumentId,
          user_id: userId || null,
          organisation_id: organisationId || null,
          granted_by_id: actx.auth.user.id,
          permission,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          created_at: nowIso(),
        }),
        'document_grants.create',
      )
    }
    if (userId) {
      const docTitle = str(p, 'title')
      await notify({userId, type: 'document', event: 'document.granted', title: 'Document access granted', body: docTitle ? `“${docTitle}” has been shared with you in the secure Document Room.` : 'A document has been shared with you in the secure Document Room.', link: '/portal/documents', emailVars: {documentTitle: docTitle ?? 'A shared document', documentNote: ' with download permission'}})
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
    const grantRow = unwrapNullable<DocumentGrantRow>(
      await supabase.from('document_grants').select('*').eq('id', grantId).maybeSingle(),
      'document_grants.get',
    )
    if (!grantRow) return fail('Grant not found.', 404)
    const grant = toCamel(grantRow)
    unwrap<null>(await supabase.from('document_grants').delete().eq('id', grantId), 'document_grants.delete')
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
    const requestRow = unwrapNullable<DocumentRequestRow>(
      await supabase.from('document_requests').select('*').eq('id', requestId).maybeSingle(),
      'document_requests.get',
    )
    if (!requestRow) return fail('Request not found.', 404)
    const request = toCamel(requestRow)
    // updated_at is maintained by the DB trigger — not set here.
    unwrap<null>(
      await supabase.from('document_requests').update({status}).eq('id', requestId),
      'document_requests.update',
    )
    if (status === 'ready') {
      await notify({userId: request.userId, type: 'document', event: 'document.request_ready', title: 'Requested materials are ready', body: 'Your document request has been fulfilled — see the secure Document Room.', link: '/portal/documents', emailVars: {documentTitle: request.subject, documentNote: ' — your requested materials'}})
    } else if (status === 'declined') {
      await notify({userId: request.userId, type: 'document', event: 'document.request_declined', title: 'Document request update', body: 'Your document request could not be fulfilled at this time. Your advisor will explain the alternatives.', link: '/portal/documents'})
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

    // compound unique (contentType, sanityId) — note: table name is SINGULAR
    const existing = unwrapNullable<ContentMetaRow>(
      await supabase.from('content_meta').select('*').eq('content_type', contentType).eq('sanity_id', sanityId).maybeSingle(),
      'content_meta.find',
    )
    if (existing) {
      // updated_at is maintained by the DB trigger — not set here.
      unwrap<null>(
        await supabase.from('content_meta').update(toSnake(data)).eq('id', existing.id),
        'content_meta.update',
      )
    } else {
      unwrap<null>(
        await supabase.from('content_meta').insert({
          id: newId(),
          content_type: contentType,
          sanity_id: sanityId,
          ...toSnake(data),
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
        'content_meta.create',
      )
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
      const existing = unwrapNullable<ContentMetaRow>(
        await supabase.from('content_meta').select('*').eq('content_type', contentType).eq('sanity_id', sanityId).maybeSingle(),
        'content_meta.find',
      )
      if (existing) {
        // updated_at is maintained by the DB trigger — not set here.
        unwrap<null>(
          await supabase.from('content_meta').update({status, updated_by_id: actx.auth.user.id}).eq('id', existing.id),
          'content_meta.update',
        )
      } else {
        unwrap<null>(
          await supabase.from('content_meta').insert({
            id: newId(),
            content_type: contentType,
            sanity_id: sanityId,
            status,
            updated_by_id: actx.auth.user.id,
            created_at: nowIso(),
            updated_at: nowIso(),
          }),
          'content_meta.create',
        )
      }
      count += 1
    }
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.content_bulk_status', entity: contentType, entityId: undefined, detail: {count, status, ids}, ...meta})
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
    const threadRow = unwrapNullable<EnquiryRow>(
      await supabase.from('enquiries').select('*').eq('id', enquiryId).maybeSingle(),
      'enquiries.get',
    )
    if (!threadRow) return fail('Thread not found.', 404)
    const thread = toCamel(threadRow)
    if (actx.advisorId) {
      const profileRow = unwrapNullable<InvestorProfileRow>(
        await supabase.from('investor_profiles').select('*').eq('user_id', thread.userId).maybeSingle(),
        'investor_profiles.get',
      )
      const profile = profileRow ? toCamel(profileRow) : null
      if (profile?.advisorId !== actx.auth.user.id) return fail('This investor is not assigned to you.', 403)
    }
    unwrap<null>(
      await supabase.from('messages').insert({
        id: newId(),
        user_id: thread.userId,
        sender_type: 'advisor',
        sender_id: actx.auth.user.id,
        enquiry_id: enquiryId,
        body,
        created_at: nowIso(),
      }),
      'messages.create',
    )
    // updated_at is maintained by the DB trigger — not set here.
    unwrap<null>(
      await supabase.from('enquiries').update({status: 'responded'}).eq('id', enquiryId),
      'enquiries.update',
    )
    await notify({userId: thread.userId, type: 'message', event: 'message.reply', title: 'Reply from your Murivest advisor', body: body.slice(0, 120), link: '/portal/activity', emailVars: {advisorName: actx.auth.user.fullName || 'Your Murivest advisor', messagePreview: body.slice(0, 160)}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.message_replied', entity: 'enquiry', entityId: enquiryId, ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'enquiry.close') {
    const g = await guard('communications.reply')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const enquiryId = str(p, 'enquiryId')
    if (!enquiryId) return fail('enquiryId required.')
    const threadRow = unwrapNullable<EnquiryRow>(
      await supabase.from('enquiries').select('*').eq('id', enquiryId).maybeSingle(),
      'enquiries.get',
    )
    if (!threadRow) return fail('Thread not found.', 404)
    // updated_at is maintained by the DB trigger — not set here.
    unwrap<null>(
      await supabase.from('enquiries').update({status: 'closed'}).eq('id', enquiryId),
      'enquiries.update',
    )
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
    unwrap<null>(
      await supabase.from('internal_notes').insert({
        id: newId(),
        entity_type: entityType,
        entity_id: entityId,
        author_id: actx.auth.user.id,
        body,
        visibility,
        created_at: nowIso(),
      }),
      'internal_notes.create',
    )
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

    // Broadcasts are controlled, audited announcements: every recipient gets
    // an ordinary notification row (with announcement_id) and full channel
    // fan-out through the dispatcher — the ledger records everything.
    const result = await dispatchAnnouncement({
      title,
      body,
      link: link ?? '/portal',
      category: 'system',
      priority: 'high',
      audience: {
        verifiedOnly: audience === 'verified',
        tiers: audience.startsWith('tier_') ? [audience] : undefined,
      },
      createdById: actx.auth.user.id,
    })
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.broadcast_sent', entity: 'announcement', entityId: result.announcementId, detail: {audience, title, recipients: result.recipients}, ...meta})
    return NextResponse.json({ok: true, recipients: result.recipients, announcementId: result.announcementId})
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
    const dupeRow = unwrapNullable<UserRow>(
      await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle(),
      'users.byEmail',
    )
    if (dupeRow) return fail('An account with this email already exists.', 409)

    const userId = newId()
    unwrap<null>(
      await supabase.from('users').insert({
        id: userId,
        email: email.toLowerCase(),
        full_name: fullName,
        password_hash: await hashPassword(password),
        role: adminRole === 'advisor' ? 'advisor' : 'admin',
        email_verified_at: nowIso(),
        created_at: nowIso(),
        updated_at: nowIso(),
      }),
      'users.create',
    )
    unwrap<null>(
      await supabase.from('staff_profiles').insert({
        id: newId(),
        user_id: userId,
        admin_role: adminRole,
        title: str(p, 'title') ?? null,
        team: str(p, 'team') ?? null,
        is_active: true,
        created_at: nowIso(),
        updated_at: nowIso(),
      }),
      'staff_profiles.create',
    )
    await securityEvent({userId, type: 'login', ...meta, detail: {created: adminRole}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.staff_created', entity: 'user', entityId: userId, detail: {email, adminRole}, ...meta})
    return NextResponse.json({ok: true, userId})
  }

  if (action === 'staff.update') {
    const g = await guard('staff.manage')
    if (isAdminResponse(g)) return g.response
    const {actx} = g
    const userId = str(p, 'userId')
    if (!userId) return fail('userId required.')
    const targetRow = unwrapNullable<UserRow>(
      await supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      'users.get',
    )
    if (!targetRow || !['advisor', 'admin'].includes(targetRow.role)) return fail('Staff member not found.', 404)
    // Prisma include {profile: true} → separate follow-up query: staff
    // accounts must not have an investor profile.
    const investorProfile = unwrapNullable<InvestorProfileRow>(
      await supabase.from('investor_profiles').select('*').eq('user_id', userId).maybeSingle(),
      'investor_profiles.get',
    )
    if (investorProfile) return fail('This account belongs to an investor, not staff.', 400)

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

    const staffRow = unwrapNullable<StaffProfileRow>(
      await supabase.from('staff_profiles').select('*').eq('user_id', userId).maybeSingle(),
      'staff_profiles.get',
    )
    if (staffRow) {
      // updated_at is maintained by the DB trigger — not set here.
      unwrap<null>(
        await supabase.from('staff_profiles').update(toSnake(data)).eq('user_id', userId),
        'staff_profiles.update',
      )
      if (data.adminRole) {
        unwrap<null>(
          await supabase.from('users').update({role: data.adminRole === 'advisor' ? 'advisor' : 'admin'}).eq('id', userId),
          'users.update',
        )
      }
    } else {
      unwrap<null>(
        await supabase.from('staff_profiles').insert({
          id: newId(),
          user_id: userId,
          admin_role: (data.adminRole as string) ?? (targetRow.role === 'admin' ? 'super_admin' : 'advisor'),
          title: (data.title as string) ?? null,
          team: (data.team as string) ?? null,
          is_active: (data.isActive as boolean) ?? true,
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
        'staff_profiles.create',
      )
    }
    // Deactivated staff lose their sessions immediately.
    if (data.isActive === false) {
      // updateMany → filtered update: revoke every live session
      unwrap<null>(
        await supabase.from('sessions').update({revoked_at: nowIso()}).eq('user_id', userId).is('revoked_at', null),
        'sessions.revokeAll',
      )
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

    const existing = unwrapNullable<SystemSettingRow>(
      await supabase.from('system_settings').select('*').eq('key', key).maybeSingle(),
      'system_settings.get',
    )
    if (existing) {
      // updated_at is maintained by the DB trigger — not set here.
      unwrap<null>(
        await supabase.from('system_settings').update({
          value,
          category,
          description: description ?? existing.description ?? null,
          updated_by_id: actx.auth.user.id,
        }).eq('id', existing.id),
        'system_settings.update',
      )
    } else {
      unwrap<null>(
        await supabase.from('system_settings').insert({
          id: newId(),
          key,
          value,
          category,
          description: description ?? null,
          updated_by_id: actx.auth.user.id,
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
        'system_settings.create',
      )
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
    const sessionRow = unwrapNullable<SessionRow>(
      await supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
      'sessions.get',
    )
    if (!sessionRow) return fail('Session not found.', 404)
    unwrap<null>(
      await supabase.from('sessions').update({revoked_at: nowIso()}).eq('id', sessionId),
      'sessions.update',
    )
    await securityEvent({userId: sessionRow.user_id, type: 'session_revoked', ...meta, detail: {by: actx.auth.user.id}})
    await audit({actorId: actx.auth.user.id, actorType: 'admin', action: 'admin.session_revoked', entity: 'session', entityId: sessionId, detail: {user: sessionRow.user_id}, ...meta})
    return NextResponse.json({ok: true})
  }

  return fail('Unknown action.')
}
