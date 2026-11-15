import {type NextRequest, NextResponse} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {requireAdminApi, isAdminResponse, type AdminContext} from '@/lib/admin/rbac'
import {fail, parseBody} from '@/lib/api'
import {audit} from '@/lib/auth/audit'
import {EMAIL_TEMPLATES} from '@/lib/notifications/email-defaults'
import {saveEmailTemplate} from '@/lib/notifications/templates'
import {sendDigestForUser, suppressPendingDeliveries, redeliverEmail, dispatchAnnouncement} from '@/lib/notifications/dispatch'
import {resolvePeriod} from '@/lib/admin/period'

/**
 * Admin Notification Operations API (spec §8).
 *
 * GET  ?scope=log|stats|templates|announcements
 *      — delivery ledger with per-investor status, bounce/failure rates,
 *        template manager state, announcement history.
 *      Advisors are scoped to their assigned investors only.
 *
 * POST actions (notifications.manage / broadcast.send):
 *   notification.suppress   override: kill pending deliveries
 *   notification.redeliver  manually (re)trigger the email channel
 *   investor.digest         force one investor's digest now
 *   investor.emailUnsuppress clear hard suppression after bounce cleanup
 *   template.save           upsert template (+ immutable version row)
 *   template.reset          remove the DB override, fall back to code default
 *   announcement.send       controlled broadcast to a segment
 */

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi('notifications.view')
  if (isAdminResponse(guard)) return guard.response
  const {actx} = guard

  const url = new URL(req.url)
  const sp = url.searchParams
  const scope = sp.get('scope') ?? 'stats'
  const period = resolvePeriod(sp.get('period') ?? '30d', undefined, undefined)

  if (scope === 'stats') {
    const since = period.from
    const deliveries = await db.notificationDelivery.findMany({
      where: {createdAt: {gte: since}},
      select: {channel: true, status: true, notification: {select: {userId: true}}},
    })
    // Advisors see aggregate stats for their assigned investors only.
    const assignedIds = actx.advisorId ? await assignedInvestorIds(actx) : null
    const scoped = assignedIds ? deliveries.filter((d) => assignedIds.has(d.notification.userId)) : deliveries

    const byChannel: Record<string, Record<string, number>> = {}
    for (const d of scoped) {
      byChannel[d.channel] ??= {}
      byChannel[d.channel][d.status] = (byChannel[d.channel][d.status] ?? 0) + 1
    }
    const emailTotal = Object.values(byChannel.email ?? {}).reduce((a, b) => a + b, 0)
    const emailFailed = (byChannel.email?.failed ?? 0) + (byChannel.email?.bounced ?? 0)
    const emailSent = byChannel.email?.sent ?? 0

    const [announcements, digestQueued, pushSubscriptions, emailSuppressedInvestors] = await Promise.all([
      db.notificationAnnouncement.count(),
      db.notificationDelivery.count({where: {channel: 'email', status: 'digest_queued'}}),
      db.pushSubscription.count({where: {revokedAt: null}}),
      db.notificationSetting.count({where: {emailSuppressed: true}}),
    ])

    return NextResponse.json({
      ok: true,
      period: {from: period.from.toISOString(), label: period.label},
      byChannel,
      totals: {
        deliveries: scoped.length,
        emailSent,
        emailFailed,
        emailBounceRate: emailTotal > 0 ? Math.round((emailFailed / emailTotal) * 1000) / 10 : 0,
        digestQueued,
        announcements,
        pushSubscriptions,
        emailSuppressedInvestors,
      },
    })
  }

  if (scope === 'log') {
    const channel = sp.get('channel')
    const status = sp.get('status')
    const take = Math.min(Number.parseInt(sp.get('take') ?? '60', 10) || 60, 200)

    const where: Record<string, unknown> = {
      ...(channel ? {channel} : {}),
      ...(status ? {status} : {}),
    }
    const rows = await db.notificationDelivery.findMany({
      where: where as never,
      orderBy: {createdAt: 'desc'},
      take,
      include: {
        notification: {
          select: {id: true, userId: true, title: true, category: true, event: true, priority: true, link: true},
        },
      },
    })
    const assignedIds = actx.advisorId ? await assignedInvestorIds(actx) : null
    const scoped = assignedIds ? rows.filter((r) => assignedIds.has(r.notification.userId)) : rows

    const users = await db.user.findMany({
      where: {id: {in: [...new Set(scoped.map((r) => r.notification.userId))]}},
      select: {id: true, email: true, fullName: true},
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    return NextResponse.json({
      ok: true,
      log: scoped.map((r) => ({
        id: r.id,
        notificationId: r.notificationId,
        channel: r.channel,
        status: r.status,
        address: r.address,
        detail: r.detail,
        sentAt: r.sentAt,
        createdAt: r.createdAt,
        notification: r.notification,
        userId: r.notification.userId,
        investor: userMap.get(r.notification.userId)
          ? {email: userMap.get(r.notification.userId)!.email, name: userMap.get(r.notification.userId)!.fullName}
          : null,
      })),
    })
  }

  if (scope === 'templates') {
    const rows = await db.emailTemplate.findMany({orderBy: {key: 'asc'}})
    const rowMap = new Map(rows.map((r) => [r.key, r]))
    const templates = Object.values(EMAIL_TEMPLATES).map((fallback) => {
      const row = rowMap.get(fallback.key)
      return {
        key: fallback.key,
        category: fallback.category,
        overridden: Boolean(row),
        isActive: row ? row.isActive : true,
        version: row?.version ?? 0,
        updatedAt: row?.updatedAt ?? null,
        subject: row?.subject ?? fallback.subject,
        preheader: row?.preheader ?? fallback.preheader,
        bodyHtml: row?.bodyHtml ?? fallback.bodyHtml,
        bodyText: row?.bodyText ?? fallback.bodyText,
        placeholders: fallback.placeholders,
      }
    })
    const versions = await db.emailTemplateVersion.findMany({
      orderBy: {createdAt: 'desc'},
      take: 50,
      include: {template: {select: {key: true}}},
    })
    return NextResponse.json({ok: true, templates, versions})
  }

  if (scope === 'announcements') {
    const rows = await db.notificationAnnouncement.findMany({
      orderBy: {createdAt: 'desc'},
      take: 30,
    })
    const senders = await db.user.findMany({where: {id: {in: [...new Set(rows.map((r) => r.createdById))]}}, select: {id: true, fullName: true, email: true}})
    const senderMap = new Map(senders.map((s) => [s.id, s]))
    return NextResponse.json({
      ok: true,
      announcements: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        link: r.link,
        category: r.category,
        priority: r.priority,
        audience: r.audience,
        recipientCount: r.recipientCount,
        sentAt: r.sentAt,
        createdAt: r.createdAt,
        createdBy: senderMap.get(r.createdById)?.fullName ?? senderMap.get(r.createdById)?.email ?? null,
      })),
    })
  }

  return fail('Unknown scope.')
}

const actionSchema = z.object({
  action: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

const str = (p: Record<string, unknown>, k: string) => (typeof p[k] === 'string' && (p[k] as string).length > 0 ? (p[k] as string) : undefined)

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, actionSchema)
  if ('response' in parsed) return parsed.response
  const {action, payload = {}} = parsed.data

  // ---------------------------------------------------------------- suppress
  if (action === 'notification.suppress') {
    const guard = await requireAdminApi('notifications.manage')
    if (isAdminResponse(guard)) return guard.response
    const notificationId = str(payload, 'notificationId')
    if (!notificationId) return fail('notificationId required.')
    const count = await suppressPendingDeliveries(notificationId, guard.actx.auth.user.id)
    return NextResponse.json({ok: true, suppressed: count})
  }

  // --------------------------------------------------------------- redeliver
  if (action === 'notification.redeliver') {
    const guard = await requireAdminApi('notifications.manage')
    if (isAdminResponse(guard)) return guard.response
    const notificationId = str(payload, 'notificationId')
    if (!notificationId) return fail('notificationId required.')
    const ok = await redeliverEmail(notificationId, guard.actx.auth.user.id)
    if (!ok) return fail('Could not redeliver (notification missing or no template).', 404)
    return NextResponse.json({ok: true})
  }

  // ------------------------------------------------------------------ digest
  if (action === 'investor.digest') {
    const guard = await requireAdminApi('notifications.manage')
    if (isAdminResponse(guard)) return guard.response
    const userId = str(payload, 'userId')
    if (!userId) return fail('userId required.')
    const result = await sendDigestForUser(userId)
    return NextResponse.json({ok: true, ...result})
  }

  // --------------------------------------------------------- unsuppress email
  if (action === 'investor.emailUnsuppress') {
    const guard = await requireAdminApi('notifications.manage')
    if (isAdminResponse(guard)) return guard.response
    const userId = str(payload, 'userId')
    if (!userId) return fail('userId required.')
    await db.notificationSetting.upsert({
      where: {userId},
      create: {userId, emailSuppressed: false},
      update: {emailSuppressed: false},
    })
    await audit({actorId: guard.actx.auth.user.id, actorType: 'admin', action: 'notification.email_unsuppressed', entity: 'user', entityId: userId})
    return NextResponse.json({ok: true})
  }

  // ------------------------------------------------------------ template save
  if (action === 'template.save') {
    const guard = await requireAdminApi('notifications.manage')
    if (isAdminResponse(guard)) return guard.response
    const key = str(payload, 'key')
    const subject = str(payload, 'subject')
    const bodyHtml = typeof payload.bodyHtml === 'string' ? payload.bodyHtml : ''
    const bodyText = typeof payload.bodyText === 'string' ? payload.bodyText : ''
    if (!key || !subject || !bodyHtml || !bodyText) return fail('key, subject, bodyHtml and bodyText required.')
    const fallback = EMAIL_TEMPLATES[key]
    if (!fallback) return fail('Unknown template key.', 404)
    if (/<script|javascript:/i.test(bodyHtml)) return fail('Template contains disallowed content.')
    const result = await saveEmailTemplate({
      key,
      category: fallback.category,
      subject,
      preheader: typeof payload.preheader === 'string' ? payload.preheader : null,
      bodyHtml,
      bodyText,
      isActive: payload.isActive === false ? false : true,
      savedById: guard.actx.auth.user.id,
    })
    return NextResponse.json({ok: true, version: result.version})
  }

  // ----------------------------------------------------------- template reset
  if (action === 'template.reset') {
    const guard = await requireAdminApi('notifications.manage')
    if (isAdminResponse(guard)) return guard.response
    const key = str(payload, 'key')
    if (!key) return fail('key required.')
    await db.emailTemplate.deleteMany({where: {key}})
    await audit({actorId: guard.actx.auth.user.id, actorType: 'admin', action: 'notification.template_reset', entity: 'email_template', entityId: key})
    return NextResponse.json({ok: true})
  }

  // -------------------------------------------------------- announcement send
  if (action === 'announcement.send') {
    const guard = await requireAdminApi('broadcast.send')
    if (isAdminResponse(guard)) return guard.response
    const title = str(payload, 'title')
    const body = str(payload, 'body')
    if (!title || !body) return fail('title and body required.')
    const audience = (payload.audience ?? {}) as Record<string, unknown>
    const arr = (k: string) => (Array.isArray(audience[k]) ? (audience[k] as string[]).filter((x) => typeof x === 'string') : undefined)

    const result = await dispatchAnnouncement({
      title,
      body,
      link: str(payload, 'link') ?? '/portal',
      category: (str(payload, 'category') as 'system') ?? 'system',
      priority: (str(payload, 'priority') as 'high') ?? 'high',
      audience: {
        tiers: arr('tiers'),
        classifications: arr('classifications'),
        advisors: arr('advisors'),
        userIds: arr('userIds'),
        verifiedOnly: audience.verifiedOnly === true,
      },
      createdById: guard.actx.auth.user.id,
    })
    return NextResponse.json({ok: true, ...result})
  }

  return fail('Unknown action.')
}

// --- helpers -----------------------------------------------------------------

async function assignedInvestorIds(actx: AdminContext): Promise<Set<string>> {
  if (!actx.advisorId) return new Set()
  const profiles = await db.investorProfile.findMany({where: {advisorId: actx.auth.user.id}, select: {userId: true}})
  return new Set(profiles.map((p) => p.userId))
}
