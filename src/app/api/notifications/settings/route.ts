import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody} from '@/lib/api'
import {audit} from '@/lib/auth/audit'
import {CHANNELS, NOTIFICATION_CATEGORIES, DEFAULT_CHANNEL_MATRIX} from '@/lib/notifications/events'
import {getEffectivePreferences} from '@/lib/notifications/preferences'

/**
 * Notification preferences — Profile & Preferences → Notifications, also
 * deep-linked from every transactional email footer (/portal/notifications).
 *
 * GET  returns the full settings state: global switches, the effective
 *      channel × category matrix, and which cells carry explicit overrides.
 * PUT  upserts the global switches and/or writes explicit matrix cells.
 *      Absent cells keep falling back to the high-signal defaults.
 */

const matrixSchema = z.object({
  channel: z.enum(CHANNELS),
  category: z.enum(NOTIFICATION_CATEGORIES),
  enabled: z.boolean(),
})

const putSchema = z.object({
  globalEnabled: z.boolean().optional(),
  quietStartMin: z.number().int().min(0).max(1439).nullable().optional(),
  quietEndMin: z.number().int().min(0).max(1439).nullable().optional(),
  digestEnabled: z.boolean().optional(),
  digestFrequency: z.enum(['daily', 'weekly']).optional(),
  /** Explicit overrides for individual cells. */
  matrix: z.array(matrixSchema).max(CHANNELS.length * NOTIFICATION_CATEGORIES.length).optional(),
  /** Reset all cells to platform defaults. */
  resetToDefaults: z.boolean().optional(),
})

export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const userId = guard.ctx.user.id

  const prefs = await getEffectivePreferences(userId)
  const [settings, subs] = await Promise.all([
    db.notificationSetting.findUnique({where: {userId}}),
    db.pushSubscription.findMany({
      where: {userId, revokedAt: null},
      select: {id: true, platform: true, deviceLabel: true, lastSeenAt: true, createdAt: true, endpoint: true},
      orderBy: {createdAt: 'desc'},
    }),
  ])

  return NextResponse.json({
    ok: true,
    settings: {
      globalEnabled: prefs.globalEnabled,
      quietStartMin: prefs.quietStartMin,
      quietEndMin: prefs.quietEndMin,
      digestEnabled: prefs.digestEnabled,
      digestFrequency: prefs.digestFrequency,
      emailSuppressed: prefs.emailSuppressed,
    },
    matrix: prefs.matrix,
    explicit: prefs.explicit,
    defaults: DEFAULT_CHANNEL_MATRIX,
    pushSubscriptions: subs,
  })
}

export async function PUT(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const userId = guard.ctx.user.id
  const parsed = await parseBody(req, putSchema)
  if ('response' in parsed) return parsed.response
  const data = parsed.data

  const settingData: Record<string, unknown> = {}
  if (data.globalEnabled !== undefined) settingData.globalEnabled = data.globalEnabled
  if (data.quietStartMin !== undefined) settingData.quietStartMin = data.quietStartMin
  if (data.quietEndMin !== undefined) settingData.quietEndMin = data.quietEndMin
  if (data.digestEnabled !== undefined) settingData.digestEnabled = data.digestEnabled
  if (data.digestFrequency !== undefined) settingData.digestFrequency = data.digestFrequency

  if (Object.keys(settingData).length > 0) {
    await db.notificationSetting.upsert({
      where: {userId},
      create: {userId, ...settingData},
      update: settingData,
    })
  }

  if (data.resetToDefaults) {
    await db.notificationPreference.deleteMany({where: {userId}})
  } else if (data.matrix && data.matrix.length > 0) {
    for (const cell of data.matrix) {
      await db.notificationPreference.upsert({
        where: {userId_channel_category: {userId, channel: cell.channel, category: cell.category}},
        create: {userId, channel: cell.channel, category: cell.category, enabled: cell.enabled},
        update: {enabled: cell.enabled},
      })
    }
  }

  await audit({
    actorId: userId,
    action: 'notification.preferences_updated',
    entity: 'user',
    entityId: userId,
    detail: {settingData, matrixCells: data.matrix?.length ?? 0, reset: data.resetToDefaults ?? false},
  })

  const prefs = await getEffectivePreferences(userId)
  return NextResponse.json({ok: true, matrix: prefs.matrix, explicit: prefs.explicit})
}
