'use client'

/**
 * Web Push client — Service Worker registration, permission handling and
 * subscription lifecycle.
 *
 * Graceful degradation (spec §9): if permission is denied, the browser does
 * not support push, or VAPID is not configured server-side, every call
 * resolves without throwing and the investor keeps in-app + email channels.
 */

export interface PushState {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  configured: boolean
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

function platformLabel(): 'desktop' | 'mobile' {
  if (typeof navigator === 'undefined') return 'desktop'
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {scope: '/'})
    await navigator.serviceWorker.ready
    return reg
  } catch {
    return null
  }
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {supported: false, permission: 'unsupported', subscribed: false, configured: false}
  }
  try {
    const res = await fetch('/api/notifications/push', {cache: 'no-store'})
    const data = res.ok ? await res.json() : {publicKey: null}
    const reg = await ensureServiceWorker()
    const subscription = reg ? await reg.pushManager.getSubscription() : null
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: Boolean(subscription),
      configured: Boolean(data.publicKey),
    }
  } catch {
    return {supported: true, permission: Notification.permission, subscribed: false, configured: false}
  }
}

export async function enablePush(): Promise<{ok: boolean; reason?: string}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {ok: false, reason: 'This browser does not support push notifications.'}
  }
  const res = await fetch('/api/notifications/push', {cache: 'no-store'})
  const data = res.ok ? await res.json() : null
  if (!data?.publicKey) return {ok: false, reason: 'Push notifications are not configured on this deployment.'}

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return {ok: false, reason: 'Permission was not granted. You can enable notifications in your browser settings at any time.'}

  const reg = await ensureServiceWorker()
  if (!reg) return {ok: false, reason: 'Service worker could not be registered.'}

  const existing = await reg.pushManager.getSubscription()
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey) as BufferSource,
    }))

  const json = subscription.toJSON()
  const save = await fetch('/api/notifications/push', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {p256dh: json.keys?.p256dh, auth: json.keys?.auth},
      platform: platformLabel(),
    }),
  })
  if (!save.ok) return {ok: false, reason: 'The subscription could not be saved. Please try again.'}
  return {ok: true}
}

export async function disablePush(): Promise<{ok: boolean}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return {ok: false}
  try {
    const reg = await ensureServiceWorker()
    const subscription = reg ? await reg.pushManager.getSubscription() : null
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe().catch(() => {})
      await fetch(`/api/notifications/push?endpoint=${encodeURIComponent(endpoint)}`, {method: 'DELETE'}).catch(() => {})
    }
    return {ok: true}
  } catch {
    return {ok: false}
  }
}
