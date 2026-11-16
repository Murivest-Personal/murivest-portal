/**
 * Notification system — event catalog & channel/category defaults.
 *
 * Single source of truth shared by the dispatch pipeline, the preference
 * centre UI and the admin workspace. The categories match the spec's
 * "By Category" structure exactly.
 */

export const NOTIFICATION_CATEGORIES = [
  'documents',
  'orders',
  'opportunities',
  'studio',
  'mandates',
  'messages',
  'security',
  'system',
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  documents: 'Documents & Data Room',
  orders: 'Orders & Briefs',
  opportunities: 'New Matching Opportunities',
  studio: 'Investment Studio & Analysis',
  mandates: 'Mandate Updates',
  messages: 'Messages from Advisor',
  security: 'Account & Security',
  system: 'Platform Announcements',
}

/** Categories whose email channel folds into the digest by default. */
export const DIGEST_ELIGIBLE: NotificationCategory[] = ['opportunities', 'studio', 'mandates', 'system']

export const PRIORITIES = ['low', 'normal', 'high', 'critical'] as const
export type NotificationPriority = (typeof PRIORITIES)[number]

export const CHANNELS = ['in_app', 'push', 'email'] as const
export type NotificationChannel = (typeof CHANNELS)[number]

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: 'In-app',
  push: 'Push (desktop & mobile)',
  email: 'Email',
}

/**
 * High-signal defaults (spec §7): security and order/document/message events
 * on everywhere; lower-priority categories on in-app only, email digest-
 * eligible. Account & Security is always-on by default and the settings UI
 * discourages disabling it.
 */
export const DEFAULT_CHANNEL_MATRIX: Record<NotificationChannel, Record<NotificationCategory, boolean>> = {
  in_app: {
    documents: true,
    orders: true,
    opportunities: true,
    studio: true,
    mandates: true,
    messages: true,
    security: true,
    system: true,
  },
  push: {
    documents: true,
    orders: true,
    opportunities: false,
    studio: false,
    mandates: false,
    messages: true,
    security: true,
    system: false,
  },
  email: {
    documents: true,
    orders: true,
    opportunities: false, // digest-eligible
    studio: false, // digest-eligible
    mandates: false, // digest-eligible
    messages: true,
    security: true,
    system: false, // digest-eligible
  },
}

/** Email templates each category maps to (keys of EMAIL_TEMPLATES). */
export const CATEGORY_EMAIL_TEMPLATES: Partial<Record<NotificationCategory, string>> = {
  documents: 'document_ready',
  orders: 'order_confirmation',
  opportunities: 'new_match',
  mandates: 'mandate_update',
  messages: 'advisor_message',
  security: 'security_alert',
  system: 'platform_notice',
}

/**
 * Fine-grained event catalog. `event` keys are written to notifications.event
 * and drive email subject/body selection and modal-vs-toast behaviour.
 */
export interface EventSpec {
  category: NotificationCategory
  priority: NotificationPriority
  /** Email template key (see email-defaults.ts); null = no email for this event. */
  emailTemplate: string | null
  /** Show as a modal in-app (sparingly — high-importance only). */
  modal?: boolean
}

export const EVENT_CATALOG: Record<string, EventSpec> = {
  // Documents & data room
  'document.uploaded': {category: 'documents', priority: 'normal', emailTemplate: 'document_ready'},
  'document.granted': {category: 'documents', priority: 'normal', emailTemplate: 'document_ready'},
  'document.ready': {category: 'documents', priority: 'high', emailTemplate: 'document_ready'},
  'document.expiring': {category: 'documents', priority: 'normal', emailTemplate: null},
  'document.signed': {category: 'documents', priority: 'normal', emailTemplate: 'document_ready'},
  'document.request_ready': {category: 'documents', priority: 'high', emailTemplate: 'document_ready'},
  'document.request_declined': {category: 'documents', priority: 'normal', emailTemplate: null},

  // Orders & briefs
  'order.received': {category: 'orders', priority: 'normal', emailTemplate: 'order_confirmation'},
  'order.payment_confirmed': {category: 'orders', priority: 'high', emailTemplate: 'brief_status'},
  'order.payment_issue': {category: 'orders', priority: 'high', emailTemplate: 'brief_status'},
  'order.in_progress': {category: 'orders', priority: 'normal', emailTemplate: 'brief_status'},
  'order.ready': {category: 'orders', priority: 'high', emailTemplate: 'brief_status'},
  'order.delivered': {category: 'orders', priority: 'high', emailTemplate: 'brief_delivered', modal: true},
  'order.status_change': {category: 'orders', priority: 'normal', emailTemplate: null},
  'order.refund': {category: 'orders', priority: 'normal', emailTemplate: 'brief_status'},
  'order.custom_acknowledged': {category: 'orders', priority: 'normal', emailTemplate: 'order_confirmation'},

  // Opportunities
  'opportunity.new_match': {category: 'opportunities', priority: 'low', emailTemplate: 'new_match'},
  'opportunity.saved_updated': {category: 'opportunities', priority: 'low', emailTemplate: null},
  'opportunity.status_change': {category: 'opportunities', priority: 'normal', emailTemplate: null},

  // Investment Studio
  'studio.scenario_reminder': {category: 'studio', priority: 'low', emailTemplate: null},

  // Mandates
  'mandate.status': {category: 'mandates', priority: 'normal', emailTemplate: 'mandate_update'},
  'mandate.opportunity_linked': {category: 'mandates', priority: 'normal', emailTemplate: null},
  'mandate.advisor_note': {category: 'mandates', priority: 'low', emailTemplate: null},
  'mandate.milestone': {category: 'mandates', priority: 'normal', emailTemplate: null},

  // Communications
  'message.new': {category: 'messages', priority: 'high', emailTemplate: 'advisor_message'},
  'message.reply': {category: 'messages', priority: 'high', emailTemplate: 'advisor_message'},
  'message.action_required': {category: 'messages', priority: 'high', emailTemplate: 'advisor_message'},

  // Account & security
  'security.new_device': {category: 'security', priority: 'critical', emailTemplate: 'security_alert'},
  'security.password_changed': {category: 'security', priority: 'critical', emailTemplate: 'security_alert'},
  'security.mfa_changed': {category: 'security', priority: 'critical', emailTemplate: 'security_alert'},
  'security.session_alert': {category: 'security', priority: 'critical', emailTemplate: 'security_alert'},
  'security.verification_update': {category: 'security', priority: 'high', emailTemplate: 'security_alert', modal: true},
  'security.tier_changed': {category: 'security', priority: 'high', emailTemplate: 'security_alert', modal: true},

  // System
  'system.announcement': {category: 'system', priority: 'high', emailTemplate: 'platform_notice'},
  'system.digest': {category: 'system', priority: 'low', emailTemplate: 'weekly_digest'},
}

/** Legacy coarse-type → category mapping (pre-multi-channel rows & callers). */
export const LEGACY_TYPE_CATEGORY: Record<string, NotificationCategory> = {
  order_status: 'orders',
  message: 'messages',
  mandate: 'mandates',
  document: 'documents',
  match: 'opportunities',
  security: 'security',
  system: 'system',
}

export const LEGACY_TYPE_PRIORITY: Record<string, NotificationPriority> = {
  security: 'critical',
  message: 'high',
  order_status: 'normal',
  mandate: 'normal',
  document: 'normal',
  match: 'low',
  system: 'normal',
}

export function isNotificationCategory(x: string): x is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(x)
}

export function categoryLabel(category: string): string {
  return isNotificationCategory(category) ? CATEGORY_LABELS[category] : category
}
