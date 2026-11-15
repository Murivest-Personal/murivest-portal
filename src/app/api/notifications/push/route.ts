import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail} from '@/lib/api'
import {audit} from '@/lib/auth/audit'
import {vapidPublicKey} from '@/lib/notifications/push'

/**
 * Web Push subscription management.
 *
 * GET    — VAPID public key (null when push is not configured; the client
 *          degrades gracefully and keeps in-app + email only).
 * POST   — save/refresh a subscription from PushManager.subscribe().
 * DELETE — unsubscribe (permission revoked or device removed by the investor).
 *
 * Subscription endpoints are delivery addresses; the payloads pushed to them
 * are minimal and non-sensitive.
 */

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256)}),
  platform: z.enum(['desktop', 'mobile', 'other']).default('desktop'),
  deviceLabel: z.string().max(80).optional(),
})

function platformFromUserAgent(ua: string | null): 'desktop' | 'mobile' | 'other' {
  if (!ua) return 'other'
  return /android|iphone|ipad|ipod|mobile|silk|kindle/i.test(ua) ? 'mobile' : 'desktop'
}

export async function GET() {
  return NextResponse.json({ok: true, publicKey: vapidPublicKey()})
}

export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const userId = guard.ctx.user.id

  const parsed = await parseBody(req, subscribeSchema)
  if ('response' in parsed) return parsed.response
  const sub = parsed.data
  const key = vapidPublicKey()
  if (!key) return fail('Push notifications are not configured on this deployment.', 503)

  const ua = req.headers.get('user-agent')
  const platform = sub.platform === 'desktop' && platformFromUserAgent(ua) === 'mobile' ? 'mobile' : sub.platform

  const existing = await db.pushSubscription.findUnique({where: {endpoint: sub.endpoint}})
  if (existing) {
    await db.pushSubscription.update({
      where: {endpoint: sub.endpoint},
      data: {userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, platform, userAgent: ua, deviceLabel: sub.deviceLabel ?? null, lastSeenAt: new Date(), revokedAt: null},
    })
  } else {
    await db.pushSubscription.create({
      data: {userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, platform, userAgent: ua, deviceLabel: sub.deviceLabel ?? null},
    })
  }

  await audit({actorId: userId, action: 'notification.push_subscribed', entity: 'push_subscription', detail: {platform, endpoint: sub.endpoint.slice(0, 64)}})
  return NextResponse.json({ok: true})
}

export async function DELETE(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const userId = guard.ctx.user.id

  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint')
  if (!endpoint) return fail('endpoint required.')

  const sub = await db.pushSubscription.findUnique({where: {endpoint}})
  if (sub && sub.userId === userId) {
    await db.pushSubscription.delete({where: {endpoint}})
    await audit({actorId: userId, action: 'notification.push_unsubscribed', entity: 'push_subscription', detail: {endpoint: endpoint.slice(0, 64)}})
  }
  return NextResponse.json({ok: true})
}
