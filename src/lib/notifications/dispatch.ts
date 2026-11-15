import {db} from '@/lib/db'
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
  const user = await db.user.findUnique({where: {id: userId}, select: {fullName: true, email: true}})
  return user?.fullName?.split(' ')[0] || 'Investor'
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
      const dup = await db.notification.findFirst({
        where: {userId: params.userId, dedupeKey: params.dedupeKey, readAt: null, createdAt: {gte: since}},
        select: {id: true},
      })
      if (dup) return {notificationId: dup.id, suppressed: false}
    }

    const notification = await db.notification.create({
      data: {
        userId: params.userId,
        category: spec.category,
        event: spec.event,
        type: params.type ?? spec.category,
        priority: spec.priority,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
        payload: (params.payload ?? undefined) as never,
        dedupeKey: params.dedupeKey ?? null,
        announcementId: params.announcementId ?? null,
      },
    })

    // In-app delivery row (the row itself is the delivery).
    await db.notificationDelivery.create({
      data: {notificationId: notification.id, channel: 'in_app', status: 'sent', sentAt: new Date()},
    })

    const [user] = await Promise.all([
      db.user.findUnique({where: {id: params.userId}, select: {email: true}}),
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

async function fanOutPush(
  notificationId: string,
  userId: string,
  spec: {category: NotificationCategory; priority: NotificationPriority; event: string | null},
  prefs: EffectivePreferences,
  params: NotifyParams,
) {
  const enabled = prefs.matrix.push[spec.category]
  if (!enabled) {
    await db.notificationDelivery.create({
      data: {notificationId, channel: 'push', status: 'skipped', detail: 'disabled in preferences'},
    }).catch(() => {})
    return
  }
  // Quiet hours silence everything except security-critical events.
  if (inQuietHours(prefs) && !(spec.category === 'security' && spec.priority === 'critical')) {
    await db.notificationDelivery.create({
      data: {notificationId, channel: 'push', status: 'skipped', detail: 'quiet hours'},
    }).catch(() => {})
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
    await db.notificationDelivery.create({
      data: {notificationId, channel: 'push', status: 'skipped', detail: 'no active push subscription'},
    }).catch(() => {})
    return
  }
  for (const r of results) {
    await db.notificationDelivery.create({
      data: {
        notificationId,
        channel: 'push',
        status: r.status === 'gone' ? 'bounced' : r.status,
        address: r.deviceLabel,
        detail: r.detail ?? null,
        sentAt: r.status === 'sent' ? new Date() : null,
      },
    }).catch(() => {})
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
    await db.notificationDelivery.create({
      data: {notificationId, channel: 'email', status: 'skipped', detail: enabled ? 'no email template for event' : 'disabled in preferences'},
    }).catch(() => {})
    return
  }
  if (prefs.emailSuppressed) {
    await db.notificationDelivery.create({
      data: {notificationId, channel: 'email', status: 'suppressed', detail: 'hard suppression (admin)'},
    }).catch(() => {})
    return
  }

  // Digest-eligible, non-urgent mail folds into the next digest.
  if (digestEligible(prefs, spec.category) && (spec.priority === 'low' || spec.priority === 'normal')) {
    await db.notificationDelivery.create({
      data: {notificationId, channel: 'email', status: 'digest_queued', detail: `${prefs.digestFrequency} digest`},
    }).catch(() => {})
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
  const user = await db.user.findUnique({where: {id: userId}, select: {email: true, fullName: true}})
  if (!user) return
  const firstName = user.fullName?.split(' ')[0] || 'Investor'

  const rendered = await renderEmail(templateKey, {
    firstName,
    link: absoluteLink(params.link),
    ...params.emailVars,
  })

  const result = await sendMail({to: user.email, subject: rendered.subject, text: rendered.text, html: rendered.html})
  await db.notificationDelivery.create({
    data: {
      notificationId,
      channel: 'email',
      status: result.delivered ? 'sent' : result.bounced ? 'bounced' : 'failed',
      address: maskEmail(user.email),
      detail: result.delivered ? null : (result.error ?? (result.devLink ? 'SMTP not configured (dev)' : 'send failed')),
      messageId: result.messageId ?? null,
      sentAt: result.delivered ? new Date() : null,
    },
  }).catch(() => {})

  // A permanent bounce flips the investor's hard-suppression flag so no
  // further email is attempted until an advisor clears it.
  if (result.bounced) {
    await db.notificationSetting.upsert({
      where: {userId},
      create: {userId, emailSuppressed: true},
      update: {emailSuppressed: true},
    }).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

/** Build & send one investor's digest; marks the queued deliveries sent. */
export async function sendDigestForUser(userId: string): Promise<{sent: boolean; itemCount: number}> {
  const queued = await db.notificationDelivery.findMany({
    where: {channel: 'email', status: 'digest_queued', notification: {userId}},
    include: {notification: {select: {title: true, body: true, link: true, category: true, createdAt: true}}},
    orderBy: {createdAt: 'asc'},
    take: 25,
  })
  if (queued.length === 0) return {sent: false, itemCount: 0}

  const user = await db.user.findUnique({where: {id: userId}, select: {email: true, fullName: true}})
  if (!user) return {sent: false, itemCount: 0}
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
  const now = new Date()
  for (const q of queued) {
    await db.notificationDelivery.update({
      where: {id: q.id},
      data: result.delivered
        ? {status: 'sent', sentAt: now, detail: 'digest'}
        : {status: result.bounced ? 'bounced' : 'failed', detail: result.error ?? 'digest send failed'},
    }).catch(() => {})
  }
  await audit({actorType: 'system', action: 'notification.digest_sent', entity: 'user', entityId: userId, detail: {items: queued.length, delivered: result.delivered}})
  return {sent: result.delivered, itemCount: queued.length}
}

/** Run the digest for every opted-in investor with queued items. */
export async function runDigest(): Promise<{users: number; items: number}> {
  const settings = await db.notificationSetting.findMany({where: {digestEnabled: true}, select: {userId: true}})
  let items = 0
  let users = 0
  for (const s of settings) {
    const res = await sendDigestForUser(s.userId)
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

  const profileFilters: Record<string, unknown> = {}
  if (audience.tiers?.length) profileFilters.accessTier = {in: audience.tiers}
  if (audience.classifications?.length) profileFilters.classification = {in: audience.classifications}
  if (audience.advisors?.length) profileFilters.advisorId = {in: audience.advisors}
  if (audience.verifiedOnly) profileFilters.verificationStatus = 'verified'

  const profiles = await db.investorProfile.findMany({
    where: profileFilters,
    select: {userId: true},
  })
  const explicit = audience.userIds?.length
    ? await db.user.findMany({where: {id: {in: audience.userIds}, role: 'investor'}, select: {id: true}})
    : []
  const recipientIds = new Set<string>([...profiles.map((p) => p.userId), ...explicit.map((u) => u.id)])

  const announcement = await db.notificationAnnouncement.create({
    data: {
      title: params.title,
      body: params.body,
      link: params.link ?? null,
      category: params.category ?? 'system',
      priority: params.priority ?? 'high',
      audience: (audience as unknown) as never,
      createdById: params.createdById,
      recipientCount: recipientIds.size,
      sentAt: new Date(),
    },
  })

  for (const userId of recipientIds) {
    await notifyUser({
      userId,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
      event: 'system.announcement',
      type: 'system',
      priority: params.priority ?? 'high',
      announcementId: announcement.id,
      payload: {announcementId: announcement.id},
      emailVars: {noticeTitle: params.title, noticeBody: params.body},
    })
  }

  await audit({
    actorId: params.createdById,
    actorType: 'admin',
    action: 'notification.announcement_sent',
    entity: 'announcement',
    entityId: announcement.id,
    detail: {recipients: recipientIds.size, title: params.title},
  })

  return {announcementId: announcement.id, recipients: recipientIds.size}
}

// ---------------------------------------------------------------------------
// Admin overrides
// ---------------------------------------------------------------------------

/** Suppress any not-yet-sent (queued / digest) channels of a notification. */
export async function suppressPendingDeliveries(notificationId: string, adminId: string): Promise<number> {
  const res = await db.notificationDelivery.updateMany({
    where: {notificationId, status: {in: ['queued', 'digest_queued']}},
    data: {status: 'suppressed', detail: 'admin override'},
  })
  await audit({
    actorId: adminId,
    actorType: 'admin',
    action: 'notification.delivery_suppressed',
    entity: 'notification',
    entityId: notificationId,
    detail: {count: res.count},
  })
  return res.count
}

/** Manually (re)trigger the email channel of an existing notification. */
export async function redeliverEmail(notificationId: string, adminId: string): Promise<boolean> {
  const notification = await db.notification.findUnique({where: {id: notificationId}})
  if (!notification) return false
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
