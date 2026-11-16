'use client'

import {createClient, type SupabaseClient} from '@supabase/supabase-js'
import {
  REALTIME_NOTIFICATION_EVENT,
  REALTIME_READ_EVENT,
  userNotificationChannel,
  type LiveNotification,
} from '@/lib/notifications/channels'

/**
 * Browser-side Supabase Realtime client (anon/publishable key ONLY).
 *
 * The service-role key never reaches the browser. This client is used for
 * exactly one thing: subscribing to the signed-in user's per-user broadcast
 * channel so active notifications arrive over a websocket instead of a poll.
 *
 * Env (Supabase Dashboard → Settings → API):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY     — the public anon/publishable key
 *
 * When the anon key is absent (or Realtime is disabled on the project) every
 * helper here reports "unavailable" and the UI falls back to the SSE stream.
 */

let cached: SupabaseClient | undefined

/** True when the browser can open a Realtime websocket (anon key present). */
export function realtimeConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getRealtimeClient(): SupabaseClient | null {
  if (!realtimeConfigured()) return null
  if (!cached) {
    // One socket per browser (survives route changes + HMR remounts).
    const g = globalThis as typeof globalThis & {__murivestRealtime?: SupabaseClient}
    if (!g.__murivestRealtime) {
      g.__murivestRealtime = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: {persistSession: false, autoRefreshToken: false},
        realtime: {params: {eventsPerSecond: 10}},
        global: {headers: {'X-Client-Info': 'murivest-portal-browser'}},
      })
    }
    cached = g.__murivestRealtime
  }
  return cached
}

function isLiveNotification(x: unknown): x is LiveNotification {
  if (!x || typeof x !== 'object') return false
  const n = x as Partial<LiveNotification>
  return typeof n.id === 'string' && typeof n.title === 'string' && typeof n.createdAt === 'string'
}

/**
 * Subscribe to the given user's notification channel over the Supabase
 * Realtime websocket. Returns an unsubscribe function, or null when realtime
 * is unavailable (caller falls back to the SSE stream).
 *
 * The socket auto-reconnects on drop; supabase-js resubscribes the channel.
 */
export function subscribeToUserNotifications(
  userId: string,
  handlers: {onNotification: (n: LiveNotification) => void; onRead?: () => void},
): (() => void) | null {
  const client = getRealtimeClient()
  if (!client) return null

  const channel = client.channel(userNotificationChannel(userId), {
    config: {broadcast: {self: false}, presence: {key: userId}},
  })

  const onRead = handlers.onRead
  channel.on('broadcast', {event: REALTIME_NOTIFICATION_EVENT}, (message) => {
    const payload = (message as unknown as {payload?: unknown}).payload
    if (isLiveNotification(payload)) handlers.onNotification(payload)
  })
  if (onRead) {
    channel.on('broadcast', {event: REALTIME_READ_EVENT}, () => onRead())
  }
  channel.subscribe()

  return () => {
    try {
      client.removeChannel(channel)
    } catch {
      /* socket already gone */
    }
  }
}
