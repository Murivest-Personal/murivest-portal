import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody} from '@/lib/api'
import {getEffectivePreferences} from '@/lib/notifications/preferences'
import {vapidPublicKey} from '@/lib/notifications/push'

const schema = z.object({ids: z.array(z.string().max(64)).max(100).optional(), all: z.boolean().optional()})

/** POST — mark notifications read (single, batch, or all). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, schema)
  if ('response' in parsed) return parsed.response
  const {ids, all} = parsed.data

  if (all) {
    await db.notification.updateMany({
      where: {userId: guard.ctx.user.id, readAt: null},
      data: {readAt: new Date()},
    })
  } else if (ids && ids.length > 0) {
    await db.notification.updateMany({
      where: {userId: guard.ctx.user.id, id: {in: ids}, readAt: null},
      data: {readAt: new Date()},
    })
  }
  return NextResponse.json({ok: true})
}

/**
 * GET — notifications feed for the Notification Centre.
 *   ?tab=unread|all   (default all)
 *   ?before=<iso>     pagination cursor
 *
 * Returns notifications, unread count, channel health (push subscribed /
 * VAPID available) and the effective category matrix so the centre can hint
 * at suppressed channels.
 */
export async function GET(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const userId = guard.ctx.user.id

  const url = new URL(req.url)
  const tab = url.searchParams.get('tab') === 'unread' ? 'unread' : 'all'
  const before = url.searchParams.get('before')

  const where = {
    userId,
    ...(tab === 'unread' ? {readAt: null} : {}),
    ...(before ? {createdAt: {lt: new Date(before)}} : {}),
  }

  const [notifications, unreadRow, prefs, subs] = await Promise.all([
    db.notification.findMany({where, orderBy: {createdAt: 'desc'}, take: 50}),
    db.notification.aggregate({_count: {_all: true}, where: {userId, readAt: null}}),
    getEffectivePreferences(userId),
    db.pushSubscription.count({where: {userId, revokedAt: null}}),
  ])

  return NextResponse.json({
    ok: true,
    notifications,
    unread: unreadRow._count._all,
    tab,
    channels: {
      pushSubscribed: subs > 0,
      pushAvailable: Boolean(vapidPublicKey()),
      globalEnabled: prefs.globalEnabled,
      quietHours: prefs.quietStartMin != null && prefs.quietEndMin != null,
    },
  })
}
