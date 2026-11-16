import {type NextRequest, NextResponse} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, toCamel, toCamelList, unwrapCount, toSnake, nowIso, newId} from '@/lib/supabase'
import {requireAdminApi, isAdminResponse, type AdminContext} from '@/lib/admin/rbac'
import {fail, parseBody} from '@/lib/api'
import {audit} from '@/lib/auth/audit'
import {EMAIL_TEMPLATES} from '@/lib/notifications/email-defaults'
import {saveEmailTemplate} from '@/lib/notifications/templates'
import {sendDigestForUser, suppressPendingDeliveries, redeliverEmail, dispatchAnnouncement} from '@/lib/notifications/dispatch'
import {resolvePeriod} from '@/lib/admin/period'
import type {EmailTemplateRow, EmailTemplateVersionRow, InvestorProfileRow, NotificationAnnouncementRow, NotificationDeliveryRow, NotificationRow, UserRow} from '@/lib/db-types'

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
    // NOTE: Prisma `include` → separate queries + JS join (no PostgREST embeds).
    const deliveryRows = unwrap<Pick<NotificationDeliveryRow, 'notification_id' | 'channel' | 'status'>[]>(
      await supabase
        .from('notification_deliveries')
        .select('notification_id, channel, status')
        .gte('created_at', since.toISOString()),
      'adminNotifications.deliveries',
    )
    const notificationIds = [...new Set(deliveryRows.map((d) => d.notification_id))]
    const notificationRows = notificationIds.length
      ? unwrap<Pick<NotificationRow, 'id' | 'user_id'>[]>(
          await supabase.from('notifications').select('id, user_id').in('id', notificationIds),
          'adminNotifications.deliveryNotifications',
        )
      : []
    const userIdByNotification = new Map(notificationRows.map((n) => [n.id, n.user_id]))
    const deliveries = deliveryRows.map((d) => ({channel: d.channel, status: d.status, userId: userIdByNotification.get(d.notification_id) ?? ''}))
    // Advisors see aggregate stats for their assigned investors only.
    const assignedIds = actx.advisorId ? await assignedInvestorIds(actx) : null
    const scoped = assignedIds ? deliveries.filter((d) => assignedIds.has(d.userId)) : deliveries

    const byChannel: Record<string, Record<string, number>> = {}
    for (const d of scoped) {
      byChannel[d.channel] ??= {}
      byChannel[d.channel][d.status] = (byChannel[d.channel][d.status] ?? 0) + 1
    }
    const emailTotal = Object.values(byChannel.email ?? {}).reduce((a, b) => a + b, 0)
    const emailFailed = (byChannel.email?.failed ?? 0) + (byChannel.email?.bounced ?? 0)
    const emailSent = byChannel.email?.sent ?? 0

    const [announcements, digestQueued, pushSubscriptions, emailSuppressedInvestors] = await Promise.all([
      supabase.from('notification_announcements').select('*', {count: 'exact', head: true}).then((r) => unwrapCount(r, 'adminNotifications.announcementCount')),
      supabase.from('notification_deliveries').select('*', {count: 'exact', head: true}).eq('channel', 'email').eq('status', 'digest_queued').then((r) => unwrapCount(r, 'adminNotifications.digestQueuedCount')),
      supabase.from('push_subscriptions').select('*', {count: 'exact', head: true}).is('revoked_at', null).then((r) => unwrapCount(r, 'adminNotifications.pushCount')),
      supabase.from('notification_settings').select('*', {count: 'exact', head: true}).eq('email_suppressed', true).then((r) => unwrapCount(r, 'adminNotifications.suppressedCount')),
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

    let deliveryQuery = supabase.from('notification_deliveries').select('*')
    if (channel) deliveryQuery = deliveryQuery.eq('channel', channel)
    if (status) deliveryQuery = deliveryQuery.eq('status', status)

    const deliveryRows = unwrap<NotificationDeliveryRow[]>(
      await deliveryQuery.order('created_at', {ascending: false}).limit(take),
      'adminNotifications.deliveryLog',
    )
    // NOTE: Prisma `include` → separate queries + JS join (no PostgREST embeds).
    const notificationIds = [...new Set(deliveryRows.map((r) => r.notification_id))]
    const notificationRows = notificationIds.length
      ? unwrap<Pick<NotificationRow, 'id' | 'user_id' | 'title' | 'category' | 'event' | 'priority' | 'link'>[]>(
          await supabase.from('notifications').select('id, user_id, title, category, event, priority, link').in('id', notificationIds),
          'adminNotifications.deliveryNotifications',
        )
      : []
    const notificationById = new Map(notificationRows.map((n) => [n.id, toCamel(n)]))

    const assignedIds = actx.advisorId ? await assignedInvestorIds(actx) : null
    const scoped = assignedIds
      ? deliveryRows.filter((r) => notificationById.get(r.notification_id) && assignedIds.has(notificationById.get(r.notification_id)!.userId))
      : deliveryRows.filter((r) => notificationById.get(r.notification_id))

    const userIds = [...new Set(scoped.map((r) => notificationById.get(r.notification_id)!.userId))]
    const userRows = userIds.length
      ? unwrap<Pick<UserRow, 'id' | 'email' | 'full_name'>[]>(
          await supabase.from('users').select('id, email, full_name').in('id', userIds),
          'adminNotifications.users',
        )
      : []
    const userMap = new Map(userRows.map((u) => [u.id, toCamel(u)]))

    return NextResponse.json({
      ok: true,
      log: scoped.map((r) => {
        const notification = notificationById.get(r.notification_id)!
        const investor = userMap.get(notification.userId)
        return {
          id: r.id,
          notificationId: r.notification_id,
          channel: r.channel,
          status: r.status,
          address: r.address,
          detail: r.detail,
          sentAt: r.sent_at,
          createdAt: r.created_at,
          notification,
          userId: notification.userId,
          investor: investor ? {email: investor.email, name: investor.fullName} : null,
        }
      }),
    })
  }

  if (scope === 'templates') {
    const templateRows = unwrap<EmailTemplateRow[]>(
      await supabase.from('email_templates').select('*').order('key', {ascending: true}),
      'adminNotifications.templates',
    )
    const rowMap = new Map(templateRows.map((r) => [r.key, toCamel(r)]))
    const templates = Object.values(EMAIL_TEMPLATES).map((fallback) => {
      const row = rowMap.get(fallback.key) ?? null
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
    const versionRows = unwrap<EmailTemplateVersionRow[]>(
      await supabase.from('email_template_versions').select('*').order('created_at', {ascending: false}).limit(50),
      'adminNotifications.templateVersions',
    )
    // NOTE: Prisma `include` (template key) → separate query + JS join.
    const templateIds = [...new Set(versionRows.map((v) => v.template_id))]
    const keyRows = templateIds.length
      ? unwrap<Pick<EmailTemplateRow, 'id' | 'key'>[]>(
          await supabase.from('email_templates').select('id, key').in('id', templateIds),
          'adminNotifications.templateKeys',
        )
      : []
    const keyById = new Map(keyRows.map((t) => [t.id, t.key]))
    const versions = versionRows.map((v) => ({...toCamel(v), template: {key: keyById.get(v.template_id) ?? null}}))
    return NextResponse.json({ok: true, templates, versions})
  }

  if (scope === 'announcements') {
    const announcementRows = unwrap<NotificationAnnouncementRow[]>(
      await supabase.from('notification_announcements').select('*').order('created_at', {ascending: false}).limit(30),
      'adminNotifications.announcements',
    )
    const rows = toCamelList(announcementRows)
    const senderIds = [...new Set(rows.map((r) => r.createdById).filter((x): x is string => Boolean(x)))]
    const senderRows = senderIds.length
      ? unwrap<Pick<UserRow, 'id' | 'full_name' | 'email'>[]>(
          await supabase.from('users').select('id, full_name, email').in('id', senderIds),
          'adminNotifications.senders',
        )
      : []
    const senderMap = new Map(senderRows.map((s) => [s.id, toCamel(s)]))
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
    unwrap(
      await supabase
        .from('notification_settings')
        .upsert([toSnake({id: newId(), userId, emailSuppressed: false, createdAt: nowIso(), updatedAt: nowIso()})], {
          onConflict: 'user_id',
        }),
      'adminNotifications.unsuppress',
    )
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
    unwrap(
      await supabase.from('email_templates').delete().eq('key', key),
      'adminNotifications.templateReset',
    )
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
  const profiles = unwrap<Pick<InvestorProfileRow, 'user_id'>[]>(
    await supabase.from('investor_profiles').select('user_id').eq('advisor_id', actx.auth.user.id),
    'adminNotifications.assignedInvestors',
  )
  return new Set(profiles.map((p) => p.user_id))
}

