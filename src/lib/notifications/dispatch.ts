import {
  supabase,
  unwrap,
  unwrapNullable,
  toCamel,
  toSnake,
  nowIso,
  newId,
  type CamelizeRow,
} from '@/lib/supabase'
import type {
  InvestorProfileRow,
  NotificationAnnouncementRow,
  NotificationDeliveryRow,
  NotificationRow,
  NotificationSettingRow,
  UserRow,
} from '@/lib/db-types'
import {COMPANY} from '@/lib/constants'
import {sendMail} from '@/lib/mail'
import {audit} from '@/lib/auth/audit'
import {
  CATEGORY_EMAIL_TEMPLATES,
  EVENT_CATALOG,
  LEGACY_TYPE_CATEGORY,
  LEGACY_TYPE_PRIORITY,
  type NotificationCategory,
  type NotificationPriority,
} from './events'
import {getEffectivePreferences, digestEligible, inQuietHours, type EffectivePreferences} from './preferences'
import {renderEmail} from './templates'
import {sendPushToUser, maskEmail} from './push'
import {broadcastNotification} from './realtime'

/**
 * Central multi-channel dispatcher.
 *
 * Every material investor-facing action funnels through notifyUser():
 *   1. one Notification row (the in-app record + deep link);
 *   2. per-channel fan-out honouring the investor's preference matrix,
 *      quiet hours and digest opt-in;
 *   3. a NotificationDelivery row per channel attempt (the admin ledger);
 *   4. an audit log entry.
 *
 * Payloads pushed or emailed are minimal and non-sensitive — the detail
 * lives inside the authenticated portal.
 */

export interface NotifyParams {
  userId: string
  title: string
  body?: string | null
  link?: string | null
  /** Fine-grained event key (EVENT_CATALOG) — preferred. */
  event?: string
  /** Legacy coarse key — mapped to a category when `event` is absent. */
  type?: string
  priority?: NotificationPriority
  /** Non-sensitive rendering context (entity titles, references). */
  payload?: Record<string, unknown>
  /** Idempotency key — repeated events within 48h collapse into one row. */
  dedupeKey?: string
  announcementId?: string
  /** Extra email template variables ({{tokens}}). */
  emailVars?: Record<string, string>
}

function resolveEventSpec(params: NotifyParams): {
  category: NotificationCategory
  priority: NotificationPriority
  event: string | null
  emailTemplate: string | null
} {
  if (params.event && EVENT_CATALOG[params.event]) {
    const spec = EVENT_CATALOG[params.event]
    return {
      category: spec.category,
      priority: params.priority ?? spec.priority,
      event: params.event,
      emailTemplate: spec.emailTemplate,
    }
  }
  const legacyType = params.type ?? 'system'
  const category = LEGACY_TYPE_CATEGORY[legacyType] ?? 'system'
  const priority = params.priority ?? LEGACY_TYPE_PRIORITY[legacyType] ?? 'normal'
  return {
    category,
    priority,
    event: params.event ?? null,
    emailTemplate: CATEGORY_EMAIL_TEMPLATES[category] ?? null,
  }
}

function absoluteLink(link?: string | null): string {
  if (!link) return `${COMPANY.siteUrl}/portal`
  if (/^https?:\/\//.test(link)) return link
  return `${COMPANY.siteUrl}${link.startsWith('/') ? '' : '/'}${link}`
}

async function firstNameOf(userId: string): Promise<string> {
  const userRow = unwrapNullable<Pick<UserRow, 'full_name' | 'email'>>(
    await supabase.from('users').select('full_name,email').eq('id', userId).maybeSingle(),
    'users.byId',
  )
  return userRow?.full_name?.split(' ')[0] || 'Investor'
}

export async function notifyUser(params: NotifyParams): Promise<{notificationId: string | null; suppressed: boolean}> {
  try {
    const spec = resolveEventSpec(params)
    const prefs = await getEffectivePreferences(params.userId)

    // Master switch / in-app suppression: record nothing except security
    // (recommended always on). Audit keeps the trail either way.
    const inAppOn = prefs.matrix.in_app[spec.category]
    if (!prefs.globalEnabled && spec.category !== 'security') {
      await audit({
        actorType: 'system',
        action: 'notification.suppressed_global',
        entity: 'notification',
        detail: {category: spec.category, event: spec.event, title: params.title},
      })
      return {notificationId: null, suppressed: true}
    }
    if (!inAppOn && spec.category !== 'security') {
      await audit({
        actorType: 'system',
        action: 'notification.suppressed_preference',
        entity: 'notification',
        detail: {category: spec.category, channel: 'in_app'},
      })
      return {notificationId: null, suppressed: true}
    }

    // Dedupe (48h window on the same key while unread).
    if (params.dedupeKey) {
      const since = new Date(Date.now() - 48 * 3600 * 1000)
      const dup = unwrapNullable<Pick<NotificationRow, 'id'>>(
        await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', params.userId)
          .eq('dedupe_key', params.dedupeKey)
          .is('read_at', null)
          .gte('created_at', since.toISOString())
          .order('created_at', {ascending: false})
          .limit(1)
          .maybeSingle(),
        'notifications.dedupe',
      )
      if (dup) return {notificationId: dup.id, suppressed: false}
    }

    // NOTE: sequential (no multi-table tx over PostgREST) — the notification
    // row and its in-app ledger row are written one after the other.
    const notificationRow = unwrap<NotificationRow>(
      await supabase
        .from('notifications')
        .insert({
          id: newId(),
          user_id: params.userId,
          category: spec.category,
          event: spec.event,
          type: params.type ?? spec.category,
          priority: spec.priority,
          title: params.title,
          body: params.body ?? null,
          link: params.link ?? null,
          payload: params.payload ?? null,
          dedupe_key: params.dedupeKey ?? null,
          announcement_id: params.announcementId ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        })
        .select('*')
        .single(),
      'notifications.create',
    )
    const notification = toCamel(notificationRow)

    // Live leg — Supabase Realtime websocket: every open session (portal or
    // admin shell, phone or desktop) toasts and refreshes its badge within
    // milliseconds. Fire-and-forget; never blocks the business flow.
    void broadcastNotification(params.userId, {
      id: notification.id,
      category: spec.category,
      event: spec.event,
      priority: spec.priority,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      createdAt: notification.createdAt,
    })

    // In-app delivery row (the row itself is the delivery).
    unwrap<NotificationDeliveryRow>(
      await supabase
        .from('notification_deliveries')
        .insert({
          id: newId(),
          notification_id: notification.id,
          channel: 'in_app',
          status: 'sent',
          sent_at: nowIso(),
          created_at: nowIso(),
        })
        .select('*')
        .single(),
      'deliveries.createInApp',
    )

    const [user] = await Promise.all([
      (async () =>
        unwrapNullable<Pick<UserRow, 'email'>>(
          await supabase.from('users').select('email').eq('id', params.userId).maybeSingle(),
          'users.byId',
        ))(),
      fanOutPush(notification.id, params.userId, spec, prefs, params),
      fanOutEmail(notification.id, params.userId, spec, prefs, params),
    ])
    void user // email fetched inside fanOutEmail

    await audit({
      actorType: 'system',
      action: 'notification.dispatched',
      entity: 'notification',
      entityId: notification.id,
      detail: {category: spec.category, event: spec.event, priority: spec.priority, to: params.userId},
    })

    return {notificationId: notification.id, suppressed: false}
  } catch (err) {
    // Notification failures must never break the primary business flow.
    console.error('[notify:error]', err instanceof Error ? err.message : err)
    return {notificationId: null, suppressed: false}
  }
}

/** Fire-and-forget ledger row — failures are swallowed (was .catch(() => {})). */
async function recordDelivery(row: {
  notificationId: string
  channel: 'in_app' | 'push' | 'email'
  status: string
  address?: string | null
  detail?: string | null
  messageId?: string | null
  sentAt?: string | null
}): Promise<void> {
  await supabase
    .from('notification_deliveries')
    .insert({
      id: newId(),
      notification_id: row.notificationId,
      channel: row.channel,
      status: row.status,
      address: row.address ?? null,
      detail: row.detail ?? null,
      message_id: row.messageId ?? null,
      sent_at: row.sentAt ?? null,
      created_at: nowIso(),
    })
    .then(() => undefined, () => undefined)
}

async function fanOutPush(
  notificationId: string,
  userId: string,
  spec: {category: NotificationCategory; priority: NotificationPriority; event: string | null},
  prefs: EffectivePreferences,
  params: NotifyParams,
) {
  const enabled = prefs.matrix.push[spec.category]
  if (!enabled) {
    await recordDelivery({notificationId, channel: 'push', status: 'skipped', detail: 'disabled in preferences'})
    return
  }
  // Quiet hours silence everything except security-critical events.
  if (inQuietHours(prefs) && !(spec.category === 'security' && spec.priority === 'critical')) {
    await recordDelivery({notificationId, channel: 'push', status: 'skipped', detail: 'quiet hours'})
    return
  }
  const results = await sendPushToUser(userId, {
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    notificationId,
    category: spec.category,
    priority: spec.priority,
  })
  if (results.length === 0) {
    await recordDelivery({notificationId, channel: 'push', status: 'skipped', detail: 'no active push subscription'})
    return
  }
  for (const r of results) {
    await recordDelivery({
      notificationId,
      channel: 'push',
      status: r.status === 'gone' ? 'bounced' : r.status,
      address: r.deviceLabel,
      detail: r.detail ?? null,
      sentAt: r.status === 'sent' ? nowIso() : null,
    })
  }
}

async function fanOutEmail(
  notificationId: string,
  userId: string,
  spec: {category: NotificationCategory; priority: NotificationPriority; event: string | null; emailTemplate: string | null},
  prefs: EffectivePreferences,
  params: NotifyParams,
) {
  const templateKey = spec.emailTemplate
  const enabled = prefs.matrix.email[spec.category]
  if (!enabled || !templateKey) {
    await recordDelivery({
      notificationId,
      channel: 'email',
      status: 'skipped',
      detail: enabled ? 'no email template for event' : 'disabled in preferences',
    })
    return
  }
  if (prefs.emailSuppressed) {
    await recordDelivery({notificationId, channel: 'email', status: 'suppressed', detail: 'hard suppression (admin)'})
    return
  }

  // Digest-eligible, non-urgent mail folds into the next digest.
  if (digestEligible(prefs, spec.category) && (spec.priority === 'low' || spec.priority === 'normal')) {
    await recordDelivery({notificationId, channel: 'email', status: 'digest_queued', detail: `${prefs.digestFrequency} digest`})
    return
  }

  await deliverEmailNow(notificationId, userId, templateKey, params)
}

async function deliverEmailNow(
  notificationId: string,
  userId: string,
  templateKey: string,
  params: NotifyParams,
) {
  const userRow = unwrapNullable<Pick<UserRow, 'email' | 'full_name'>>(
    await supabase.from('users').select('email,full_name').eq('id', userId).maybeSingle(),
    'users.byId',
  )
  if (!userRow) return
  const user = toCamel(userRow)
  const firstName = user.fullName?.split(' ')[0] || 'Investor'

  const rendered = await renderEmail(templateKey, {
    firstName,
    link: absoluteLink(params.link),
    ...params.emailVars,
  })

  const result = await sendMail({to: user.email, subject: rendered.subject, text: rendered.text, html: rendered.html})
  await recordDelivery({
    notificationId,
    channel: 'email',
    status: result.delivered ? 'sent' : result.bounced ? 'bounced' : 'failed',
    address: maskEmail(user.email),
    detail: result.delivered ? null : (result.error ?? (result.devLink ? 'SMTP not configured (dev)' : 'send failed')),
    messageId: result.messageId ?? null,
    sentAt: result.delivered ? nowIso() : null,
  })

  // A permanent bounce flips the investor's hard-suppression flag so no
  // further email is attempted until an advisor clears it.
  if (result.bounced) {
    await supabase
      .from('notification_settings')
      .upsert([toSnake({id: newId(), userId, emailSuppressed: true, createdAt: nowIso(), updatedAt: nowIso()})], {
        onConflict: 'user_id',
      })
      .then(() => undefined, () => undefined)
  }
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

type QueuedNotification = CamelizeRow<
  Pick<NotificationRow, 'title' | 'body' | 'link' | 'category' | 'created_at'>
>

/** Build & send one investor's digest; marks the queued deliveries sent. */
export async function sendDigestForUser(userId: string): Promise<{sent: boolean; itemCount: number}> {
  // include → separate queries + JS join: the ledger has no user column, so
  // resolve the investor's notification ids first, then the queued rows.
  const notifIdRows = unwrap<Pick<NotificationRow, 'id'>[]>(
    await supabase.from('notifications').select('id').eq('user_id', userId),
    'notifications.byUser',
  )
  if (notifIdRows.length === 0) return {sent: false, itemCount: 0}
  const deliveryRows = unwrap<NotificationDeliveryRow[]>(
    await supabase
      .from('notification_deliveries')
      .select('*')
      .in('notification_id', notifIdRows.map((r) => r.id))
      .eq('channel', 'email')
      .eq('status', 'digest_queued')
      .order('created_at', {ascending: true})
      .limit(25),
    'deliveries.digestQueued',
  )
  if (deliveryRows.length === 0) return {sent: false, itemCount: 0}
  const notifRows = unwrap<Pick<NotificationRow, 'id' | 'title' | 'body' | 'link' | 'category' | 'created_at'>[]>(
    await supabase
      .from('notifications')
      .select('id,title,body,link,category,created_at')
      .in('id', [...new Set(deliveryRows.map((d) => d.notification_id))]),
    'notifications.byIds',
  )
  const notifById = new Map(notifRows.map((n) => [n.id, toCamel(n)]))
  const queued: {id: string; notification: QueuedNotification}[] = []
  for (const d of deliveryRows) {
    const notification = notifById.get(d.notification_id)
    if (notification) queued.push({id: d.id, notification})
  }

  const userRow = unwrapNullable<Pick<UserRow, 'email' | 'full_name'>>(
    await supabase.from('users').select('email,full_name').eq('id', userId).maybeSingle(),
    'users.byId',
  )
  if (!userRow) return {sent: false, itemCount: 0}
  const user = toCamel(userRow)
  const firstName = user.fullName?.split(' ')[0] || 'Investor'

  const itemsHtml = `<ul style="margin:0 0 16px;padding-left:18px;">${queued
    .map(
      (q) =>
        `<li style="margin-bottom:10px;"><strong style="color:${'#1B4332'};">${escapeHtml(q.notification.title)}</strong>` +
        (q.notification.body ? `<br><span style="color:${'#6B6B60'};">${escapeHtml(q.notification.body.slice(0, 140))}</span>` : '') +
        `</li>`,
    )
    .join('')}</ul>`
  const itemsText = queued.map((q) => `- ${q.notification.title}${q.notification.body ? ` — ${q.notification.body.slice(0, 140)}` : ''}`).join('\n')

  const rendered = await renderEmail('weekly_digest', {
    firstName,
    digestCount: String(queued.length),
    digestPlural: queued.length === 1 ? '' : 's',
    itemsHtml,
    itemsText,
    link: `${COMPANY.siteUrl}/portal`,
  })

  const result = await sendMail({to: user.email, subject: rendered.subject, text: rendered.text, html: rendered.html})
  const now = nowIso()
  for (const q of queued) {
    await supabase
      .from('notification_deliveries')
      .update(
        result.delivered
          ? {status: 'sent', sent_at: now, detail: 'digest'}
          : {status: result.bounced ? 'bounced' : 'failed', detail: result.error ?? 'digest send failed'},
      )
      .eq('id', q.id)
      .then(() => undefined, () => undefined)
  }
  await audit({actorType: 'system', action: 'notification.digest_sent', entity: 'user', entityId: userId, detail: {items: queued.length, delivered: result.delivered}})
  return {sent: result.delivered, itemCount: queued.length}
}

/** Run the digest for every opted-in investor with queued items. */
export async function runDigest(): Promise<{users: number; items: number}> {
  const settings = unwrap<Pick<NotificationSettingRow, 'user_id'>[]>(
    await supabase.from('notification_settings').select('user_id').eq('digest_enabled', true),
    'notificationSettings.digestOptIns',
  )
  let items = 0
  let users = 0
  for (const s of settings) {
    const res = await sendDigestForUser(s.user_id)
    if (res.sent) {
      users += 1
      items += res.itemCount
    }
  }
  return {users, items}
}

// ---------------------------------------------------------------------------
// Announcements (admin, controlled + audited)
// ---------------------------------------------------------------------------

export interface AnnouncementAudience {
  tiers?: string[]
  classifications?: string[]
  advisors?: string[]
  userIds?: string[]
  verifiedOnly?: boolean
}

export async function dispatchAnnouncement(params: {
  title: string
  body: string
  link?: string | null
  category?: NotificationCategory
  priority?: NotificationPriority
  audience: AnnouncementAudience
  createdById: string
}): Promise<{announcementId: string; recipients: number}> {
  const {audience} = params

  let profileQuery = supabase.from('investor_profiles').select('user_id')
  if (audience.tiers?.length) profileQuery = profileQuery.in('access_tier', audience.tiers)
  if (audience.classifications?.length) profileQuery = profileQuery.in('classification', audience.classifications)
  if (audience.advisors?.length) profileQuery = profileQuery.in('advisor_id', audience.advisors)
  if (audience.verifiedOnly) profileQuery = profileQuery.eq('verification_status', 'verified')

  const profiles = unwrap<Pick<InvestorProfileRow, 'user_id'>[]>(await profileQuery, 'investorProfiles.announcementAudience')
  const explicit = audience.userIds?.length
    ? unwrap<Pick<UserRow, 'id'>[]>(
        await supabase.from('users').select('id').in('id', audience.userIds).eq('role', 'investor'),
        'users.announcementExplicit',
      )
    : []
  const recipientIds = new Set<string>([...profiles.map((p) => p.user_id), ...explicit.map((u) => u.id)])

  const announcementId = newId()
  unwrap<NotificationAnnouncementRow>(
    await supabase
      .from('notification_announcements')
      .insert({
        id: announcementId,
        title: params.title,
        body: params.body,
        link: params.link ?? null,
        category: params.category ?? 'system',
        priority: params.priority ?? 'high',
        audience: audience,
        created_by_id: params.createdById,
        recipient_count: recipientIds.size,
        sent_at: nowIso(),
        created_at: nowIso(),
      })
      .select('*')
      .single(),
    'notificationAnnouncements.create',
  )

  for (const userId of recipientIds) {
    await notifyUser({
      userId,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
      event: 'system.announcement',
      type: 'system',
      priority: params.priority ?? 'high',
      announcementId: announcementId,
      payload: {announcementId: announcementId},
      emailVars: {noticeTitle: params.title, noticeBody: params.body},
    })
  }

  await audit({
    actorId: params.createdById,
    actorType: 'admin',
    action: 'notification.announcement_sent',
    entity: 'announcement',
    entityId: announcementId,
    detail: {recipients: recipientIds.size, title: params.title},
  })

  return {announcementId: announcementId, recipients: recipientIds.size}
}

// ---------------------------------------------------------------------------
// Admin overrides
// ---------------------------------------------------------------------------

/** Suppress any not-yet-sent (queued / digest) channels of a notification. */
export async function suppressPendingDeliveries(notificationId: string, adminId: string): Promise<number> {
  // updateMany → filtered PostgREST update; count = the returned (updated) rows.
  const res = await supabase
    .from('notification_deliveries')
    .update({status: 'suppressed', detail: 'admin override'})
    .eq('notification_id', notificationId)
    .in('status', ['queued', 'digest_queued'])
    .select('id')
  const count = unwrap<Pick<NotificationDeliveryRow, 'id'>[]>(res, 'deliveries.suppressPending').length
  await audit({
    actorId: adminId,
    actorType: 'admin',
    action: 'notification.delivery_suppressed',
    entity: 'notification',
    entityId: notificationId,
    detail: {count},
  })
  return count
}

/** Manually (re)trigger the email channel of an existing notification. */
export async function redeliverEmail(notificationId: string, adminId: string): Promise<boolean> {
  const notificationRow = unwrapNullable<NotificationRow>(
    await supabase.from('notifications').select('*').eq('id', notificationId).maybeSingle(),
    'notifications.byId',
  )
  if (!notificationRow) return false
  const notification = toCamel(notificationRow)
  const spec = notification.event && EVENT_CATALOG[notification.event]
    ? EVENT_CATALOG[notification.event]
    : {category: notification.category as NotificationCategory, priority: notification.priority as NotificationPriority, emailTemplate: CATEGORY_EMAIL_TEMPLATES[notification.category as NotificationCategory] ?? null}
  if (!spec.emailTemplate) return false
  await deliverEmailNow(notificationId, notification.userId, spec.emailTemplate, {
    userId: notification.userId,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    event: notification.event ?? undefined,
    type: notification.type,
    emailVars: (notification.payload as Record<string, string> | null) ?? undefined,
  })
  await audit({actorId: adminId, actorType: 'admin', action: 'notification.email_redelivered', entity: 'notification', entityId: notificationId})
  return true
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
