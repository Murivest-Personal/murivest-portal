/* eslint-disable no-undef */
/**
 * Murivest Private Capital Portal — Service Worker
 *
 * Responsibilities (notifications spec §5/§9):
 *  • receive Web Push payloads (desktop + installed PWA/mobile) even when
 *    the tab is closed, and surface them as OS notifications;
 *  • mirror received notifications into IndexedDB so the in-app
 *    Notification Centre is current the next time the portal opens;
 *  • deep-link notification clicks into the correct portal section;
 *  • background sync of read state when back online.
 *
 * Payloads are minimal and non-sensitive by design: title, short body,
 * deep link, ids. Confidential detail is only ever rendered inside the
 * authenticated portal.
 */

const DB_NAME = 'murivest-portal'
const DB_VERSION = 1
const STORE = 'notifications'
const CACHE_READ_FLAG = 'murivest-read-sync' // localStorage flag shared with the page

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, {keyPath: 'id'})
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function storeNotification(item) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(item)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    // Offline cache is best-effort; the authenticated API remains the
    // source of truth whenever the portal is open.
    if (typeof console !== 'undefined') console.warn('[sw:cache]', err)
  }
}

async function markRead(id) {
  try {
    const db = await openDb()
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        if (getReq.result) {
          getReq.result.readAt = new Date().toISOString()
          store.put(getReq.result)
        }
      }
      tx.oncomplete = resolve
    })
  } catch (err) {
    /* best-effort */
  }
}

async function syncReadState() {
  // Push read markers recorded while offline up to the server.
  try {
    const raw = await self.localStorage.getItem(CACHE_READ_FLAG)
    if (!raw) return
    const ids = JSON.parse(raw)
    if (!Array.isArray(ids) || ids.length === 0) return
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ids: ids.slice(0, 100)}),
    })
    await self.localStorage.removeItem(CACHE_READ_FLAG)
  } catch (err) {
    /* still offline — retry on next sync event */
  }
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (err) {
    payload = {title: 'Murivest portal', body: event.data ? event.data.text() : ''}
  }

  const title = payload.title || 'Murivest portal'
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: payload.notificationId || undefined,
    // Persist critical/security notifications until dismissed; the rest
    // auto-dismiss per OS behaviour.
    requireInteraction: payload.priority === 'critical',
    data: {
      link: payload.link || '/portal',
      notificationId: payload.notificationId || null,
      category: payload.category || 'system',
      priority: payload.priority || 'normal',
      createdAt: payload.createdAt || new Date().toISOString(),
      title,
      body: payload.body || '',
    },
    // Rich notifications where supported: one quiet action deep-links in.
    actions: [{action: 'open', title: 'Open portal'}],
  }

  event.waitUntil(
    (async () => {
      await storeNotification({
        id: payload.notificationId || `sw-${Date.now()}`,
        category: payload.category || 'system',
        event: payload.event || null,
        priority: payload.priority || 'normal',
        title,
        body: payload.body || null,
        link: payload.link || null,
        readAt: null,
        createdAt: payload.createdAt || new Date().toISOString(),
        source: 'push',
      })
      await self.registration.showNotification(title, options)
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const link = data.link || '/portal'

  event.waitUntil(
    (async () => {
      if (data.notificationId) await markRead(data.notificationId)
      const clientList = await self.clients.matchAll({type: 'window', includeUncontrolled: true})
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus()
          if (client.url && 'navigate' in client) {
            try {
              await client.navigate(link)
            } catch (err) {
              /* cross-origin navigate not allowed — fall through */
            }
          }
          return
        }
      }
      await self.clients.openWindow(link)
    })(),
  )
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'murivest-read-sync') {
    event.waitUntil(syncReadState())
  }
})
