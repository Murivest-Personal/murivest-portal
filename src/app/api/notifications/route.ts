import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, toCamelList, unwrapCount, nowIso} from '@/lib/supabase'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody} from '@/lib/api'
import {getEffectivePreferences} from '@/lib/notifications/preferences'
import {vapidPublicKey} from '@/lib/notifications/push'
import type {NotificationRow} from '@/lib/db-types'

const schema = z.object({ids: z.array(z.string().max(64)).max(100).optional(), all: z.boolean().optional()})

/** POST — mark notifications read (single, batch, or all). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, schema)
  if ('response' in parsed) return parsed.response
  const {ids, all} = parsed.data

  if (all) {
    unwrap(
      await supabase
        .from('notifications')
        .update({read_at: nowIso()})
        .eq('user_id', guard.ctx.user.id)
        .is('read_at', null),
      'notifications.markAllRead',
    )
  } else if (ids && ids.length > 0) {
    unwrap(
      await supabase
        .from('notifications')
        .update({read_at: nowIso()})
        .eq('user_id', guard.ctx.user.id)
        .in('id', ids)
        .is('read_at', null),
      'notifications.markRead',
    )
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

  let feedQuery = supabase.from('notifications').select('*').eq('user_id', userId)
  if (tab === 'unread') feedQuery = feedQuery.is('read_at', null)
  if (before) feedQuery = feedQuery.lt('created_at', new Date(before).toISOString())

  const [feedRes, unreadRes, prefs, subsRes] = await Promise.all([
    feedQuery.order('created_at', {ascending: false}).limit(50),
    supabase.from('notifications').select('*', {count: 'exact', head: true}).eq('user_id', userId).is('read_at', null),
    getEffectivePreferences(userId),
    supabase.from('push_subscriptions').select('*', {count: 'exact', head: true}).eq('user_id', userId).is('revoked_at', null),
  ])
  const notifications = toCamelList(unwrap<NotificationRow[]>(feedRes, 'notifications.feed'))
  const unread = unwrapCount(unreadRes, 'notifications.unreadCount')
  const subs = unwrapCount(subsRes, 'pushSubscriptions.count')

  return NextResponse.json({
    ok: true,
    notifications,
    unread,
    tab,
    channels: {
      pushSubscribed: subs > 0,
      pushAvailable: Boolean(vapidPublicKey()),
      globalEnabled: prefs.globalEnabled,
      quietHours: prefs.quietStartMin != null && prefs.quietEndMin != null,
    },
  })
}
