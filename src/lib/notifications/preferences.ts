import {supabase, unwrap, unwrapNullable, toCamel, toCamelList} from '@/lib/supabase'
import type {NotificationPreferenceRow, NotificationSettingRow} from '@/lib/db-types'
import {
  CHANNELS,
  DEFAULT_CHANNEL_MATRIX,
  DIGEST_ELIGIBLE,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationChannel,
} from './events'

/**
 * Preference resolution — merges the investor's explicit channel × category
 * matrix (notification_preferences rows) over the high-signal defaults
 * (events.ts), then applies the global switches (notification_settings):
 * master enable, quiet hours and the digest opt-in.
 */

export interface EffectivePreferences {
  globalEnabled: boolean
  quietStartMin: number | null
  quietEndMin: number | null
  digestEnabled: boolean
  digestFrequency: 'daily' | 'weekly'
  emailSuppressed: boolean
  /** effective[channel][category] — after defaults + explicit rows + global switch. */
  matrix: Record<NotificationChannel, Record<NotificationCategory, boolean>>
  /** True when the row exists in the DB (used by the settings UI to show overrides). */
  explicit: Record<NotificationChannel, Partial<Record<NotificationCategory, boolean>>>
}

export async function getEffectivePreferences(userId: string): Promise<EffectivePreferences> {
  const [settingsRes, prefsRes] = await Promise.all([
    supabase.from('notification_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('notification_preferences').select('*').eq('user_id', userId),
  ])
  const settingsRow = unwrapNullable<NotificationSettingRow>(settingsRes, 'notificationSettings.byUser')
  const rows = toCamelList(unwrap<NotificationPreferenceRow[]>(prefsRes, 'notificationPreferences.byUser'))
  const settings = settingsRow ? toCamel(settingsRow) : null

  const explicit: EffectivePreferences['explicit'] = {
    in_app: {},
    push: {},
    email: {},
  }
  for (const row of rows) {
    const channel = row.channel as NotificationChannel
    if (!CHANNELS.includes(channel)) continue
    if (NOTIFICATION_CATEGORIES.includes(row.category as NotificationCategory)) {
      explicit[channel][row.category as NotificationCategory] = row.enabled
    }
  }

  const globalEnabled = settings?.globalEnabled ?? true
  const matrix = {} as EffectivePreferences['matrix']
  for (const channel of CHANNELS) {
    matrix[channel] = {} as Record<NotificationCategory, boolean>
    for (const category of NOTIFICATION_CATEGORIES) {
      const override = explicit[channel][category]
      const base = override ?? DEFAULT_CHANNEL_MATRIX[channel][category]
      // Master switch disables everything except in-app storage (rows are
      // still recorded so the centre has history; delivery is suppressed).
      matrix[channel][category] = globalEnabled ? base : channel === 'in_app'
    }
  }

  return {
    globalEnabled,
    quietStartMin: settings?.quietStartMin ?? null,
    quietEndMin: settings?.quietEndMin ?? null,
    digestEnabled: settings?.digestEnabled ?? false,
    digestFrequency: (settings?.digestFrequency as 'daily' | 'weekly') ?? 'weekly',
    emailSuppressed: settings?.emailSuppressed ?? false,
    matrix,
    explicit,
  }
}

/** Quiet hours: suppress push (never security-critical) & non-critical email. */
export function inQuietHours(prefs: EffectivePreferences, at: Date = new Date()): boolean {
  if (prefs.quietStartMin == null || prefs.quietEndMin == null) return false
  const minutes = at.getUTCHours() * 60 + at.getUTCMinutes() // server approximates; investor TZ supplied by client where known
  const {quietStartMin: start, quietEndMin: end} = prefs
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/** Should this email be folded into the digest instead of sent immediately? */
export function digestEligible(prefs: EffectivePreferences, category: NotificationCategory): boolean {
  return prefs.digestEnabled && DIGEST_ELIGIBLE.includes(category)
}
