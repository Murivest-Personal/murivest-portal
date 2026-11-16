import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, toCamel, toCamelList, newId, nowIso} from '@/lib/supabase'
import {hashPassword, passwordPolicyError} from '@/lib/auth/password'
import {audit, notify, securityEvent} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {fail, clientMeta} from '@/lib/api'
import type {
  CamelizeRow,
  DocumentRequestRow,
  EnquiryRow,
  InvestorProfileRow,
  MandateRow,
  OrderRow,
  PaymentRow,
  UserRow,
} from '@/lib/db-types'

/** Column subset for the investor desk list (snake_case, DB shape). */
type InvestorListRow = Pick<
  InvestorProfileRow,
  | 'user_id'
  | 'classification'
  | 'verification_status'
  | 'kyc_status'
  | 'access_tier'
  | 'nda_accepted'
  | 'advisor_id'
  | 'onboarding_step'
  | 'created_at'
  | 'organisation_id'
>
type InvestorListUserRow = Pick<UserRow, 'id' | 'email' | 'full_name' | 'last_login_at'>

/**
 * Murivest desk operations (advisor / admin). One guarded dispatcher:
 *  verify_investor · order_status · verify_payment · reply ·
 *  mandate_status · add_milestone · grant_document · doc_request_status ·
 *  create_advisor · list_investors
 *
 * Every action is permission-checked server-side and audit-logged.
 */
const schema = z.object({
  action: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  if (!ctx.isStaff) return fail('Staff access required.', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Invalid request.')
  const {action} = parsed.data
  const p = (parsed.data.payload ?? {}) as Record<string, unknown>
  const meta = clientMeta(req)
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined)
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : undefined)

  switch (action) {
    // --- Verification & tier assignment ----------------------------------
    case 'verify_investor': {
      const userId = str('userId')
      if (!userId) return fail('userId required.')
      const verificationStatus = str('verificationStatus')
      const kycStatus = str('kycStatus')
      const accessTier = str('accessTier')
      const advisorId = str('advisorId')
      const targetRow = unwrapNullable<InvestorProfileRow>(
        await supabase.from('investor_profiles').select('*').eq('user_id', userId).maybeSingle(),
        'investorProfile.byUser',
      )
      if (!targetRow) return fail('Investor not found.', 404)
      const target = toCamel(targetRow)

      unwrap<null>(
        await supabase
          .from('investor_profiles')
          .update({
            ...(verificationStatus ? {verification_status: verificationStatus} : {}),
            ...(kycStatus ? {kyc_status: kycStatus} : {}),
            ...(accessTier ? {access_tier: accessTier} : {}),
            ...(advisorId !== undefined ? {advisor_id: advisorId || null} : {}),
          })
          .eq('user_id', userId),
        'investorProfile.update',
      )
      if (accessTier && accessTier !== target.accessTier) {
        await notify({
          userId,
          type: 'system',
          event: 'security.tier_changed',
          title: 'Access tier updated',
          body: `Your Murivest access tier is now ${accessTier.replace('_', ' ')}. Sign in to review newly available material.`,
          link: '/portal',
          emailVars: {alertTitle: 'Access tier updated', alertDetail: `Your Murivest access tier is now ${accessTier.replace('_', ' ')}. Newly available material can be reviewed when you next sign in.`},
        })
      }
      if (kycStatus === 'approved' && target.kycStatus !== 'approved') {
        await notify({userId, type: 'system', event: 'security.verification_update', title: 'Verification approved', body: 'Your KYC verification is approved. Confidential opportunities and off-market material are now visible where permitted.', link: '/portal/discover', emailVars: {alertTitle: 'Verification approved', alertDetail: 'Your KYC verification is approved. Confidential opportunities and off-market material are now visible where permitted.'}})
      }
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'permission.changed', entity: 'profile', entityId: target.id, detail: {verificationStatus, kycStatus, accessTier, advisorId}, ...meta})
      return NextResponse.json({ok: true})
    }

    case 'list_investors': {
      // NOTE: Prisma relation select (`user: {select: ...}`) -> follow-up
      // query on `users` + JS join (no PostgREST embeds).
      const profileRows = unwrap<InvestorListRow[]>(
        await supabase
          .from('investor_profiles')
          .select(
            'user_id, classification, verification_status, kyc_status, access_tier, nda_accepted, advisor_id, onboarding_step, created_at, organisation_id',
          )
          .order('created_at', {ascending: false})
          .limit(200),
        'investorProfile.list',
      )
      const profiles = toCamelList(profileRows)
      const userIds = [...new Set(profiles.map((profile) => profile.userId))]
      const userRows = userIds.length
        ? unwrap<InvestorListUserRow[]>(
            await supabase.from('users').select('id, email, full_name, last_login_at').in('id', userIds),
            'users.list',
          )
        : []
      const usersById = new Map(
        userRows.map((u): [string, CamelizeRow<InvestorListUserRow>] => [u.id, toCamel(u)]),
      )
      const investors = profiles.map((profile) => ({...profile, user: usersById.get(profile.userId) ?? null}))
      return NextResponse.json({ok: true, investors})
    }

    // --- Orders & payments --------------------------------------------------
    case 'order_status': {
      const orderId = str('orderId')
      const status = str('status')
      const trackingNumber = str('trackingNumber')
      if (!orderId || !status) return fail('orderId and status required.')
      const orderRow = unwrapNullable<OrderRow>(
        await supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
        'order.byId',
      )
      if (!orderRow) return fail('Order not found.', 404)
      const order = toCamel(orderRow)

      unwrap<null>(
        await supabase
          .from('orders')
          .update({
            status,
            ...(trackingNumber !== undefined ? {tracking_number: trackingNumber || null} : {}),
            ...(status === 'delivered' ? {delivered_at: nowIso()} : {}),
          })
          .eq('id', orderId),
        'order.updateStatus',
      )
      const statusLabel = status.replace('_', ' ')
      await notify({
        userId: order.userId,
        type: 'order_status',
        event:
          status === 'delivered' ? 'order.delivered'
          : status === 'processing' ? 'order.in_progress'
          : status === 'ready' ? 'order.ready'
          : 'order.status_change',
        priority: ['delivered', 'ready'].includes(status) ? 'high' : 'normal',
        title: `Order ${order.reference} · ${statusLabel}`,
        body:
          status === 'delivered'
            ? `“${order.briefTitle}” has been delivered${order.format === 'hard_copy' ? ' by courier' : ' to your Document Room'}.`
            : `Your order “${order.briefTitle}” is now ${statusLabel}.`,
        link: '/portal/orders',
        dedupeKey: `order.${order.id}.${status}`,
        emailVars: {
          briefTitle: order.briefTitle,
          orderRef: order.reference,
          statusLabel: statusLabel.replace(/^\w/, (c) => c.toUpperCase()),
          statusNote: `Your order “${order.briefTitle}” is now ${statusLabel}.`,
        },
      })
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'order.status_changed', entity: 'order', entityId: orderId, detail: {status, trackingNumber}, ...meta})
      return NextResponse.json({ok: true})
    }

    case 'verify_payment': {
      const paymentId = str('paymentId')
      const decision = str('decision') // verified | rejected
      const note = str('note')
      if (!paymentId || !decision) return fail('paymentId and decision required.')
      const paymentRow = unwrapNullable<PaymentRow>(
        await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle(),
        'payment.byId',
      )
      if (!paymentRow) return fail('Payment not found.', 404)
      // NOTE: Prisma `include: {order: true}` -> follow-up query + JS join.
      // payments.order_id is a NOT NULL FK; unwrap<OrderRow> preserves the
      // former crash-on-missing behaviour if the row were somehow absent.
      const orderRow = unwrap<OrderRow>(
        await supabase.from('orders').select('*').eq('id', paymentRow.order_id).single(),
        'payment.order',
      )
      const payment = {...toCamel(paymentRow), order: toCamel(orderRow)}

      unwrap<null>(
        await supabase
          .from('payments')
          .update({status: decision, verified_by_id: ctx.user.id, verified_at: nowIso(), note: note ?? null})
          .eq('id', paymentId),
        'payment.update',
      )
      if (decision === 'verified') {
        unwrap<null>(
          await supabase.from('orders').update({status: 'processing'}).eq('id', payment.orderId),
          'order.markProcessing',
        )
        await notify({userId: payment.userId, type: 'order_status', event: 'order.payment_confirmed', title: 'Payment confirmed', body: `Payment for ${payment.order.reference} is confirmed. Preparation of “${payment.order.briefTitle}” has begun.`, link: '/portal/orders', emailVars: {briefTitle: payment.order.briefTitle, orderRef: payment.order.reference, statusLabel: 'Payment confirmed', statusNote: `Payment for ${payment.order.reference} is confirmed. Preparation of “${payment.order.briefTitle}” has begun.`}})
      } else {
        await notify({userId: payment.userId, type: 'order_status', event: 'order.payment_issue', title: 'Payment could not be verified', body: `We could not verify the payment for ${payment.order.reference}. ${note || 'Please contact your advisor.'}`, link: '/portal/orders', emailVars: {briefTitle: payment.order.briefTitle, orderRef: payment.order.reference, statusLabel: 'Payment could not be verified', statusNote: `We could not verify the payment for ${payment.order.reference}. ${note || 'Please contact your advisor.'}`}})
      }
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'payment.verified', entity: 'payment', entityId: paymentId, detail: {decision, note}, ...meta})
      return NextResponse.json({ok: true})
    }

    // --- Communications -----------------------------------------------------
    case 'reply': {
      const enquiryId = str('enquiryId')
      const body = str('body')
      if (!enquiryId || !body) return fail('enquiryId and body required.')
      const threadRow = unwrapNullable<EnquiryRow>(
        await supabase.from('enquiries').select('*').eq('id', enquiryId).maybeSingle(),
        'enquiry.byId',
      )
      if (!threadRow) return fail('Thread not found.', 404)
      unwrap<null>(
        await supabase
          .from('messages')
          .insert({
            id: newId(),
            user_id: threadRow.user_id,
            sender_type: 'advisor',
            sender_id: ctx.user.id,
            enquiry_id: enquiryId,
            body,
            created_at: nowIso(),
          }),
        'message.create',
      )
      unwrap<null>(
        await supabase.from('enquiries').update({status: 'responded'}).eq('id', enquiryId),
        'enquiry.updateStatus',
      )
      await notify({userId: threadRow.user_id, type: 'message', event: 'message.reply', title: 'Reply from your Murivest advisor', body: body.slice(0, 120), link: '/portal/activity', emailVars: {advisorName: ctx.user.fullName || 'Your Murivest advisor', messagePreview: body.slice(0, 160)}})
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'message.replied', entity: 'enquiry', entityId: enquiryId, ...meta})
      return NextResponse.json({ok: true})
    }

    // --- Mandates -------------------------------------------------------------
    case 'mandate_status': {
      const mandateId = str('mandateId')
      const status = str('status')
      const advisorId = str('advisorId')
      if (!mandateId || !status) return fail('mandateId and status required.')
      const mandateRow = unwrapNullable<MandateRow>(
        await supabase.from('mandates').select('*').eq('id', mandateId).maybeSingle(),
        'mandate.byId',
      )
      if (!mandateRow) return fail('Mandate not found.', 404)
      const mandate = toCamel(mandateRow)
      unwrap<null>(
        await supabase
          .from('mandates')
          .update({
            status,
            ...(advisorId !== undefined ? {advisor_id: advisorId || null} : {}),
            ...(status === 'active' ? {activated_at: nowIso()} : {}),
            ...(status === 'closed' ? {closed_at: nowIso()} : {}),
          })
          .eq('id', mandateId),
        'mandate.updateStatus',
      )
      if (status === 'active') {
        await notify({userId: mandate.userId, type: 'mandate', event: 'mandate.status', title: `Mandate ${mandate.reference} activated`, body: 'Your acquisition mandate is live. Opportunities matching it will be surfaced in Discover and communicated by your advisor.', link: '/portal/mandates', emailVars: {mandateRef: mandate.reference, mandateTitle: mandate.title, mandateStatus: 'activated', mandateNote: 'Your acquisition mandate is live. Opportunities matching it will be surfaced in Discover and communicated by your advisor.'}})
      }
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'mandate.status_changed', entity: 'mandate', entityId: mandateId, detail: {status, advisorId}, ...meta})
      return NextResponse.json({ok: true})
    }

    case 'add_milestone': {
      const mandateId = str('mandateId')
      const title = str('title')
      const detail = str('detail')
      const dueDate = str('dueDate')
      const status = str('status')
      if (!mandateId || !title) return fail('mandateId and title required.')
      const mandateRow = unwrapNullable<MandateRow>(
        await supabase.from('mandates').select('*').eq('id', mandateId).maybeSingle(),
        'mandate.byId',
      )
      if (!mandateRow) return fail('Mandate not found.', 404)
      const mandate = toCamel(mandateRow)
      unwrap<null>(
        await supabase.from('mandate_milestones').insert({
          id: newId(),
          mandate_id: mandateId,
          title,
          detail: detail ?? null,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          status: status || 'pending',
          created_at: nowIso(),
        }),
        'mandateMilestone.create',
      )
      await notify({userId: mandate.userId, type: 'mandate', event: 'mandate.milestone', title: 'Mandate milestone added', body: `${title} was added to mandate ${mandate.reference}.`, link: '/portal/mandates'})
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'mandate.milestone_added', entity: 'mandate', entityId: mandateId, detail: {title}, ...meta})
      return NextResponse.json({ok: true})
    }

    // --- Data room ---------------------------------------------------------------
    case 'grant_document': {
      const sanityDocumentId = str('sanityDocumentId')
      const userId = str('userId')
      const organisationId = str('organisationId')
      const permission = str('permission') || 'view'
      const expiresAt = str('expiresAt')
      if (!sanityDocumentId || (!userId && !organisationId)) return fail('sanityDocumentId and userId or organisationId required.')
      unwrap<null>(
        await supabase.from('document_grants').insert({
          id: newId(),
          sanity_document_id: sanityDocumentId,
          user_id: userId || null,
          organisation_id: organisationId || null,
          granted_by_id: ctx.user.id,
          permission,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          created_at: nowIso(),
        }),
        'documentGrant.create',
      )
      if (userId) {
        const docTitle = str('title')
        await notify({userId, type: 'document', event: 'document.granted', title: 'Document access granted', body: docTitle ? `“${docTitle}” has been shared with you in the secure Document Room.` : 'A document has been shared with you in the secure Document Room.', link: '/portal/documents', emailVars: {documentTitle: docTitle ?? 'A shared document', documentNote: ''}})
      }
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'permission.granted', entity: 'document', entityId: sanityDocumentId, detail: {userId, organisationId, permission}, ...meta})
      return NextResponse.json({ok: true})
    }

    case 'doc_request_status': {
      const requestId = str('requestId')
      const status = str('status')
      if (!requestId || !status) return fail('requestId and status required.')
      const requestRow = unwrapNullable<DocumentRequestRow>(
        await supabase.from('document_requests').select('*').eq('id', requestId).maybeSingle(),
        'documentRequest.byId',
      )
      if (!requestRow) return fail('Request not found.', 404)
      unwrap<null>(
        await supabase.from('document_requests').update({status}).eq('id', requestId),
        'documentRequest.updateStatus',
      )
      if (status === 'ready') {
        await notify({userId: requestRow.user_id, type: 'document', title: 'Requested materials are ready', body: 'Your document request has been fulfilled — see the secure Document Room.', link: '/portal/documents'})
      } else if (status === 'declined') {
        await notify({userId: requestRow.user_id, type: 'document', title: 'Document request update', body: 'Your document request could not be fulfilled at this time. Your advisor will explain the alternatives.', link: '/portal/documents'})
      }
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'document_request.status_changed', entity: 'document_request', entityId: requestId, detail: {status}, ...meta})
      return NextResponse.json({ok: true})
    }

    // --- Staff administration -------------------------------------------------------
    case 'create_advisor': {
      if (!ctx.isAdmin) return fail('Administrator access required.', 403)
      const email = str('email')
      const fullName = str('fullName')
      const password = str('password')
      if (!email || !fullName || !password) return fail('email, fullName and password required.')
      const policy = passwordPolicyError(password)
      if (policy) return fail(policy)
      const existingRow = unwrapNullable<UserRow>(
        await supabase.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle(),
        'user.byEmail',
      )
      if (existingRow) return fail('An account with this email already exists.', 409)
      const userRow = unwrap<UserRow>(
        await supabase
          .from('users')
          .insert({
            id: newId(),
            email: email.toLowerCase(),
            full_name: fullName,
            password_hash: await hashPassword(password),
            role: 'advisor',
            email_verified_at: nowIso(),
            created_at: nowIso(),
            updated_at: nowIso(),
          })
          .select('*')
          .single(),
        'user.createAdvisor',
      )
      await securityEvent({userId: userRow.id, type: 'login', ...meta, detail: {created: 'advisor'}})
      await audit({actorId: ctx.user.id, actorType: 'admin', action: 'staff.advisor_created', entity: 'user', entityId: userRow.id, detail: {email}, ...meta})
      return NextResponse.json({ok: true, userId: userRow.id})
    }

    default:
      return fail('Unknown action.')
  }
}
