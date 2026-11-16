'use client'

/**
 * Offline-first notification cache (IndexedDB) — shared store name and
 * record shape with the Service Worker (public/sw.js).
 *
 * The authenticated API (/api/notifications) remains the source of truth
 * while online; this cache lets the Notification Centre render instantly
 * on load and remain usable offline. Read markers recorded offline are
 * queued and synced by the SW's background sync (or on next fetch).
 */

const DB_NAME = 'murivest-portal'
const DB_VERSION = 1
const STORE = 'notifications'
const READ_QUEUE_KEY = 'murivest-read-sync'

export interface CachedNotification {
  id: string
  category: string
  event?: string | null
  priority?: string
  title: string
  body?: string | null
  link?: string | null
  readAt?: string | null
  createdAt: string
  source?: 'api' | 'push'
}

function openDb(): Promise<IDBDatabase> {
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

export async function cacheNotifications(items: CachedNotification[]): Promise<void> {
  if (items.length === 0) return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const item of items) store.put({...item, source: 'api'})
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* cache is best-effort */
  }
}

export async function readCachedNotifications(limit = 60): Promise<CachedNotification[]> {
  try {
    const db = await openDb()
    return await new Promise<CachedNotification[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => {
        const rows = (req.result as CachedNotification[])
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, limit)
        resolve(rows)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

/** Queue a read marker for offline sync (drained by the Service Worker). */
export function queueReadMarker(id: string): void {
  try {
    const raw = window.localStorage.getItem(READ_QUEUE_KEY)
    const ids: string[] = raw ? JSON.parse(raw) : []
    if (!ids.includes(id)) ids.push(id)
    window.localStorage.setItem(READ_QUEUE_KEY, JSON.stringify(ids.slice(0, 200)))
  } catch {
    /* best-effort */
  }
}

export async function syncReadQueueNow(): Promise<void> {
  try {
    const raw = window.localStorage.getItem(READ_QUEUE_KEY)
    if (!raw) return
    const ids: string[] = JSON.parse(raw)
    if (!Array.isArray(ids) || ids.length === 0) return
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ids: ids.slice(0, 100)}),
    })
    window.localStorage.removeItem(READ_QUEUE_KEY)
  } catch {
    /* offline — the SW background sync will retry */
  }
}
