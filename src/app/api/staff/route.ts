import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {hashPassword, passwordPolicyError} from '@/lib/auth/password'
import {audit, notify, securityEvent} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {fail, clientMeta} from '@/lib/api'

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
      const target = await db.investorProfile.findUnique({where: {userId}})
      if (!target) return fail('Investor not found.', 404)

      await db.investorProfile.update({
        where: {userId},
        data: {
          ...(verificationStatus ? {verificationStatus: verificationStatus as never} : {}),
          ...(kycStatus ? {kycStatus: kycStatus as never} : {}),
          ...(accessTier ? {accessTier: accessTier as never} : {}),
          ...(advisorId !== undefined ? {advisorId: advisorId || null} : {}),
        },
      })
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
      const investors = await db.investorProfile.findMany({
        select: {
          userId: true, classification: true, verificationStatus: true, kycStatus: true,
          accessTier: true, ndaAccepted: true, advisorId: true, onboardingStep: true,
          createdAt: true,
          user: {select: {id: true, email: true, fullName: true, lastLoginAt: true}},
          organisationId: true,
        },
        orderBy: {createdAt: 'desc'},
        take: 200,
      })
      return NextResponse.json({ok: true, investors})
    }

    // --- Orders & payments --------------------------------------------------
    case 'order_status': {
      const orderId = str('orderId')
      const status = str('status')
      const trackingNumber = str('trackingNumber')
      if (!orderId || !status) return fail('orderId and status required.')
      const order = await db.order.findUnique({where: {id: orderId}})
      if (!order) return fail('Order not found.', 404)

      await db.order.update({
        where: {id: orderId},
        data: {
          status: status as never,
          ...(trackingNumber !== undefined ? {trackingNumber: trackingNumber || null} : {}),
          ...(status === 'delivered' ? {deliveredAt: new Date()} : {}),
        },
      })
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
      const payment = await db.payment.findUnique({where: {id: paymentId}, include: {order: true}})
      if (!payment) return fail('Payment not found.', 404)

      await db.payment.update({
        where: {id: paymentId},
        data: {status: decision as never, verifiedById: ctx.user.id, verifiedAt: new Date(), note: note ?? null},
      })
      if (decision === 'verified') {
        await db.order.update({where: {id: payment.orderId}, data: {status: 'processing'}})
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
      const thread = await db.enquiry.findUnique({where: {id: enquiryId}})
      if (!thread) return fail('Thread not found.', 404)
      await db.message.create({
        data: {userId: thread.userId, senderType: 'advisor', senderId: ctx.user.id, enquiryId, body},
      })
      await db.enquiry.update({where: {id: enquiryId}, data: {status: 'responded'}})
      await notify({userId: thread.userId, type: 'message', event: 'message.reply', title: 'Reply from your Murivest advisor', body: body.slice(0, 120), link: '/portal/activity', emailVars: {advisorName: ctx.user.fullName || 'Your Murivest advisor', messagePreview: body.slice(0, 160)}})
      await audit({actorId: ctx.user.id, actorType: ctx.user.role as 'advisor' | 'admin', action: 'message.replied', entity: 'enquiry', entityId: enquiryId, ...meta})
      return NextResponse.json({ok: true})
    }

    // --- Mandates -------------------------------------------------------------
    case 'mandate_status': {
      const mandateId = str('mandateId')
      const status = str('status')
      const advisorId = str('advisorId')
      if (!mandateId || !status) return fail('mandateId and status required.')
      const mandate = await db.mandate.findUnique({where: {id: mandateId}})
      if (!mandate) return fail('Mandate not found.', 404)
      await db.mandate.update({
        where: {id: mandateId},
        data: {
          status: status as never,
          ...(advisorId !== undefined ? {advisorId: advisorId || null} : {}),
          ...(status === 'active' ? {activatedAt: new Date()} : {}),
          ...(status === 'closed' ? {closedAt: new Date()} : {}),
        },
      })
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
      const mandate = await db.mandate.findUnique({where: {id: mandateId}})
      if (!mandate) return fail('Mandate not found.', 404)
      await db.mandateMilestone.create({
        data: {
          mandateId, title, detail: detail ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: (status as never) || 'pending',
        },
      })
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
      await db.documentGrant.create({
        data: {
          sanityDocumentId,
          userId: userId || null,
          organisationId: organisationId || null,
          grantedById: ctx.user.id,
          permission: permission as never,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      })
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
      const request = await db.documentRequest.findUnique({where: {id: requestId}})
      if (!request) return fail('Request not found.', 404)
      await db.documentRequest.update({where: {id: requestId}, data: {status: status as never}})
      if (status === 'ready') {
        await notify({userId: request.userId, type: 'document', title: 'Requested materials are ready', body: 'Your document request has been fulfilled — see the secure Document Room.', link: '/portal/documents'})
      } else if (status === 'declined') {
        await notify({userId: request.userId, type: 'document', title: 'Document request update', body: 'Your document request could not be fulfilled at this time. Your advisor will explain the alternatives.', link: '/portal/documents'})
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
      const existing = await db.user.findUnique({where: {email: email.toLowerCase()}})
      if (existing) return fail('An account with this email already exists.', 409)
      const user = await db.user.create({
        data: {email: email.toLowerCase(), fullName, passwordHash: await hashPassword(password), role: 'advisor', emailVerifiedAt: new Date()},
      })
      await securityEvent({userId: user.id, type: 'login', ...meta, detail: {created: 'advisor'}})
      await audit({actorId: ctx.user.id, actorType: 'admin', action: 'staff.advisor_created', entity: 'user', entityId: user.id, detail: {email}, ...meta})
      return NextResponse.json({ok: true, userId: user.id})
    }

    default:
      return fail('Unknown action.')
  }
}
