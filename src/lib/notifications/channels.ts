/**
 * Shared Realtime channel contract — imported by BOTH the server broadcast
 * helper (src/lib/notifications/realtime.ts, service-role client) and the
 * browser subscriber (src/lib/client/realtime.ts, anon-key client).
 *
 * Keep this module import-free and isomorphic: it is pure constants.
 */

/** Broadcast event carrying one new notification to the recipient's devices. */
export const REALTIME_NOTIFICATION_EVENT = 'notification'

/** Broadcast event telling the recipient's other devices to refresh read state. */
export const REALTIME_READ_EVENT = 'read'

/**
 * Per-user channel name. Broadcast payloads are minimal and non-sensitive
 * (title, short body, deep link — exactly what Web Push and email already
 * carry); the channel name itself embeds an unguessable user id, so an
 * anon-key holder cannot discover another user's channel without already
 * knowing their UUID.
 */
export function userNotificationChannel(userId: string): string {
  return `notif:${userId}`
}

/** Payload shape shared by the SSE fallback stream and the websocket leg. */
export interface LiveNotification {
  id: string
  category: string
  event?: string | null
  priority: string
  title: string
  body: string | null
  link: string | null
  createdAt: string
}
