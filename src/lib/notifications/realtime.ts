import type {RealtimeChannel} from '@supabase/supabase-js'
import {supabase, isSupabaseConfigured} from '@/lib/supabase'
import {REALTIME_NOTIFICATION_EVENT, REALTIME_READ_EVENT, userNotificationChannel, type LiveNotification} from './channels'

/**
 * Supabase Realtime (websocket) broadcast — the instant leg of the active
 * notification pipeline, for investors AND staff/admins.
 *
 * notifyUser() writes the Notification row, then broadcasts on the
 * recipient's per-user channel. Every open portal/admin tab subscribed via
 * the anon-key client (src/lib/client/realtime.ts) receives the event within
 * milliseconds and surfaces a toast + badge refresh — no polling.
 *
 * Design notes:
 *  • one long-lived server websocket (the service-role client multiplexes
 *    every joined channel over a single connection); channels are joined
 *    lazily on first broadcast to a user and cached for the process lifetime;
 *  • broadcasts never throw into the business flow — failures are warned and
 *    swallowed (in-app row, Web Push and email still deliver);
 *  • when NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured on the browser side
 *    nothing breaks: the SSE fallback stream keeps the UX alive.
 */

const SUBSCRIBE_TIMEOUT_MS = 10_000

/** channel-name -> resolved "SUBSCRIBED" promise, per server process. */
const joined = new Map<string, Promise<RealtimeChannel>>()

function joinChannel(name: string): Promise<RealtimeChannel> {
  const cached = joined.get(name)
  if (cached) return cached

  const ready = new Promise<RealtimeChannel>((resolve, reject) => {
    // The lazy service-role proxy throws synchronously when unconfigured —
    // that rejection is contained here like any other join failure.
    const channel = supabase.channel(name)
    const timer = setTimeout(() => {
      joined.delete(name)
      reject(new Error(`subscribe timeout (${name})`))
    }, SUBSCRIBE_TIMEOUT_MS)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve(channel)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        joined.delete(name)
        reject(new Error(`realtime ${status} (${name})`))
      }
    })
  })
  // A rejected cached promise would poison every later broadcast to this
  // user if left in the map un-handled — deletion above + this guard keeps
  // the cache healthy; callers still .catch() individually.
  ready.catch(() => undefined)
  joined.set(name, ready)
  return ready
}

async function send(userId: string, event: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  try {
    const channel = await joinChannel(userNotificationChannel(userId))
    const res = await channel.send({type: 'broadcast', event, payload})
    if (res !== 'ok') {
      console.warn(`[realtime] ${event} -> ${userId}: ${res}`)
      return false
    }
    return true
  } catch (err) {
    console.warn('[realtime] broadcast skipped:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Push one freshly-created notification to the recipient's live sessions
 * (phone + desktop, portal + admin). Fire-and-forget from dispatch.
 */
export function broadcastNotification(userId: string, n: LiveNotification): Promise<boolean> {
  return send(userId, REALTIME_NOTIFICATION_EVENT, {
    id: n.id,
    category: n.category,
    event: n.event ?? null,
    priority: n.priority,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    createdAt: n.createdAt,
  })
}

/**
 * Tell the recipient's OTHER devices that read state changed (mark-as-read
 * on the phone instantly clears the badge on the desktop, and vice versa).
 */
export function broadcastReadSync(userId: string): Promise<boolean> {
  return send(userId, REALTIME_READ_EVENT, {at: new Date().toISOString()})
}
