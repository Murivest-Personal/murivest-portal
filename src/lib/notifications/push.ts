import {sendNotification, setVapidDetails, WebPushError} from 'web-push'
import type {PushSubscription as WpSubscription} from 'web-push'
import {db} from '@/lib/db'

/**
 * Web Push (VAPID) delivery — desktop browsers and installed PWA/mobile.
 *
 * Keys are environment configuration (scripts/generate-vapid-keys.mjs):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:)
 *
 * Payloads are minimal and non-sensitive: title, short body, deep link,
 * notification id. Nothing confidential ever crosses the push service.
 */

let configured: boolean | null = null

function vapid(): {publicKey: string; privateKey: string; subject: string} | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:office@murivest.com'
  if (!publicKey || !privateKey) return null
  return {publicKey, privateKey, subject}
}

function ensureConfigured(): boolean {
  if (configured !== null) return configured
  const keys = vapid()
  if (keys) {
    setVapidDetails(keys.subject, keys.publicKey, keys.privateKey)
    configured = true
  } else {
    configured = false
  }
  return configured
}

export function pushConfigured(): boolean {
  return ensureConfigured()
}

export function vapidPublicKey(): string | null {
  return vapid()?.publicKey ?? null
}

export interface PushPayload {
  title: string
  body?: string | null
  link?: string | null
  notificationId: string
  category: string
  priority: string
}

export interface PushResult {
  endpointId: string
  deviceLabel: string | null
  status: 'sent' | 'failed' | 'gone' | 'skipped'
  detail?: string
}

const TIMEOUT_MS = 8000

/** Deliver a push payload to every active subscription of one investor. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult[]> {
  if (!ensureConfigured()) {
    return [{endpointId: '-', deviceLabel: null, status: 'skipped', detail: 'VAPID keys not configured'}]
  }
  const subs = await db.pushSubscription.findMany({
    where: {userId, revokedAt: null},
  })
  if (subs.length === 0) return []

  const data = JSON.stringify(payload)
  const results: PushResult[] = []

  await Promise.all(
    subs.map(async (sub) => {
      try {
        // AbortSignal keeps a slow push service from stalling dispatch.
        await sendNotification(
          {endpoint: sub.endpoint, keys: {p256dh: sub.p256dh, auth: sub.auth}} as WpSubscription,
          data,
          {timeout: TIMEOUT_MS},
        )
        results.push({endpointId: sub.id, deviceLabel: sub.deviceLabel, status: 'sent'})
        await db.pushSubscription.update({where: {id: sub.id}, data: {lastSeenAt: new Date()}}).catch(() => {})
      } catch (err) {
        const status = err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410) ? 'gone' : 'failed'
        const detail = err instanceof Error ? err.message.slice(0, 300) : 'push error'
        if (status === 'gone') {
          await db.pushSubscription.update({where: {id: sub.id}, data: {revokedAt: new Date()}}).catch(() => {})
        }
        results.push({endpointId: sub.id, deviceLabel: sub.deviceLabel, status, detail})
      }
    }),
  )
  return results
}

/** Mask an email for the delivery ledger: j***@domain.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const head = local.slice(0, 1)
  return `${head}${'*'.repeat(Math.max(1, Math.min(local.length - 1, 4)))}@${domain}`
}
