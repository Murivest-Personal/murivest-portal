import {type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {requireApiUser, isResponse} from '@/lib/auth/context'

export const dynamic = 'force-dynamic'

/**
 * Server-Sent Events stream — real-time toasts while the investor is active.
 *
 * The client (NotificationToaster) opens one EventSource per portal session.
 * The server polls the notifications table on a light interval and pushes:
 *   event: ready          initial handshake (last id + unread count)
 *   event: notification   each new row since the cursor (id > lastId)
 *   event: read           read-state changes from other devices, so the
 *                         badge stays in sync
 * When the tab is closed the stream ends; background delivery is handled by
 * the Service Worker + Web Push instead.
 */

const POLL_MS = 15000

export async function GET(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const userId = guard.ctx.user.id

  const latest = await db.notification.findFirst({where: {userId}, orderBy: {createdAt: 'desc'}, select: {id: true, createdAt: true}})
  let cursor = latest?.createdAt ?? new Date(0)
  let lastReadMarker: Date | null = null
  let closed = false

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      const unreadCount = async () =>
        db.notification.count({where: {userId, readAt: null}})

      send('ready', {unread: await unreadCount(), cursor: cursor.toISOString()})

      const tick = async () => {
        if (closed) return
        try {
          const rows = await db.notification.findMany({
            where: {userId, createdAt: {gt: cursor}},
            orderBy: {createdAt: 'asc'},
            take: 10,
          })
          for (const row of rows) {
            cursor = row.createdAt
            send('notification', {
              id: row.id,
              category: row.category,
              event: row.event,
              priority: row.priority,
              title: row.title,
              body: row.body,
              link: row.link,
              createdAt: row.createdAt,
            })
          }
          // Read-state sync across devices: emit the newest readAt marker.
          const newestRead = await db.notification.findFirst({where: {userId, readAt: {not: null}}, orderBy: {readAt: 'desc'}, select: {readAt: true}})
          if (newestRead?.readAt && (!lastReadMarker || newestRead.readAt > lastReadMarker)) {
            lastReadMarker = newestRead.readAt
            send('read', {unread: await unreadCount()})
          } else if (rows.length > 0) {
            send('unread', {unread: await unreadCount()})
          }
        } catch {
          /* transient DB hiccup — next tick retries */
        }
      }

      const interval = setInterval(() => void tick(), POLL_MS)
      const abort = () => {
        closed = true
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      req.signal.addEventListener('abort', abort)
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
