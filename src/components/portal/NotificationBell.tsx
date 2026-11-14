'use client'

import {useEffect, useState, useCallback} from 'react'
import Link from 'next/link'
import {Bell, CheckCheck} from 'lucide-react'
import {cn} from '@/lib/utils'
import {relativeTime} from '@/lib/format'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', {cache: 'no-store'})
      if (res.ok) {
        const data = await res.json()
        setItems(data.notifications || [])
      }
    } catch {
      /* offline — keep current state */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const initial = fetch('/api/notifications', {cache: 'no-store'})
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setItems(data.notifications || [])
      })
      .catch(() => {})
    const timer = setInterval(() => {
      load().catch(() => {})
    }, 45000)
    return () => {
      cancelled = true
      clearInterval(timer)
      void initial
    }
  }, [load])

  const unread = items.filter((n) => !n.readAt).length

  async function markAll() {
    setBusy(true)
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({all: true}),
    }).catch(() => {})
    await load()
    setBusy(false)
  }

  return (
    <div>
      {/* The dropdown anchors to the sticky portal header (nearest positioned
          ancestor) — not to this 36px button wrapper — so on every screen width
          it aligns with the viewport's right margin and never clips its corners. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center border border-border text-primary transition-colors hover:border-gold hover:text-gold"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center bg-gold px-1 text-[9px] font-bold text-forest-deep">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button type="button" aria-label="Close notifications" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-5 top-[4.5rem] z-50 w-80 max-w-[calc(100vw-2.5rem)] border border-border bg-card shadow-xl sm:w-96">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Signals</span>
              <button
                type="button"
                onClick={markAll}
                disabled={busy || unread === 0}
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-gold disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>
            <div className="portal-scroll dropdown-max-h overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-3 h-8 w-8 text-gold/40" strokeWidth={1.25} />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    No signals yet. Order updates, mandate progress, document readiness and new matches will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.slice(0, 12).map((n) => (
                    <li key={n.id} className={cn('px-4 py-3', !n.readAt && 'bg-gold/5')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={cn('text-xs', n.readAt ? 'font-normal text-muted-foreground' : 'font-semibold text-primary')}>{n.title}</div>
                          {n.body ? <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.body}</p> : null}
                          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">{relativeTime(n.createdAt)}</div>
                        </div>
                        {n.link ? (
                          <Link href={n.link} onClick={() => setOpen(false)} className="flex-shrink-0 text-[10px] uppercase tracking-[0.12em] text-gold hover:underline">
                            View
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-border px-4 py-2.5">
              <Link href="/portal/activity" onClick={() => setOpen(false)} className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-gold">
                All activity & communications →
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
