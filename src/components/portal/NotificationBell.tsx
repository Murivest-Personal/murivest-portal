'use client'

import {useEffect, useState, useCallback, useMemo} from 'react'
import Link from 'next/link'
import {
  Bell,
  CheckCheck,
  Settings2,
  FolderLock,
  ClipboardList,
  Search,
  Calculator,
  ScrollText,
  MessagesSquare,
  ShieldCheck,
  Megaphone,
  MonitorSmartphone,
  X,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import {relativeTime} from '@/lib/format'
import {cacheNotifications, readCachedNotifications, queueReadMarker, syncReadQueueNow, type CachedNotification} from '@/lib/client/notification-store'
import {getPushState, enablePush, type PushState} from '@/lib/client/push'

/**
 * Notification Centre — bell + drawer, shared by the investor portal and
 * the admin shell ("both investor and admin" active notifications).
 * Unread / All tabs, grouped by date, category icons, deep links, mark-as-read,
 * an enable-push prompt, and an offline cache fallback (IndexedDB) shared with
 * the Service Worker. The drawer anchors to the sticky shell header so it
 * never clips its corners on any screen width.
 */

export interface NotificationBellProps {
  /** Where the bell's "settings" affordance points (portal: preferences page,
 *  admin: notifications workspace). */
  settingsHref?: string
  /** Where the "all activity" affordance points. */
  activityHref?: string
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{className?: string; strokeWidth?: number}>> = {
  documents: FolderLock,
  orders: ClipboardList,
  opportunities: Search,
  studio: Calculator,
  mandates: ScrollText,
  messages: MessagesSquare,
  security: ShieldCheck,
  system: Megaphone,
}

const CATEGORY_ACCENTS: Record<string, string> = {
  documents: 'text-gold',
  orders: 'text-gold',
  opportunities: 'text-primary/70',
  studio: 'text-primary/70',
  mandates: 'text-primary/70',
  messages: 'text-gold',
  security: 'text-[#9C3B2E]',
  system: 'text-primary/60',
}

interface FeedItem extends CachedNotification {
  readAt: string | null
}

function dateGroupLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  if (d >= startOfToday) return 'Today'
  if (d >= startOfYesterday) return 'Yesterday'
  if (d >= new Date(startOfToday.getTime() - 6 * 86400000)) return 'This week'
  if (d >= new Date(startOfToday.getTime() - 27 * 86400000)) return 'This month'
  return 'Earlier'
}

export default function NotificationBell({settingsHref = '/portal/notifications', activityHref = '/portal/activity'}: NotificationBellProps) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [cached, setCached] = useState<FeedItem[]>([])
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'unread' | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [push, setPush] = useState<PushState | null>(null)
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [offline, setOffline] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', {cache: 'no-store'})
      if (res.ok) {
        const data = await res.json()
        const rows: FeedItem[] = (data.notifications ?? []).map((n: FeedItem) => ({
          id: n.id,
          category: n.category,
          event: n.event ?? null,
          priority: n.priority ?? 'normal',
          title: n.title,
          body: n.body ?? null,
          link: n.link ?? null,
          readAt: n.readAt ?? null,
          createdAt: n.createdAt,
        }))
        setItems(rows)
        setOffline(false)
        void cacheNotifications(rows)
        void syncReadQueueNow()
      }
    } catch {
      // Offline — fall back to the IndexedDB cache so the centre stays usable.
      setOffline(true)
      const rows = await readCachedNotifications()
      setCached(rows.map((r) => ({...r, readAt: r.readAt ?? null})))
    }
  }, [])

  useEffect(() => {
    // Initial load deferred to a task so setState never runs synchronously
    // inside the effect body (react-hooks/set-state-in-effect).
    const initial = setTimeout(() => void load(), 0)
    const timer = setInterval(() => void load(), 45000)
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    const onStream = () => void load()
    window.addEventListener('murivest:notifications-changed', onStream)
    return () => {
      clearTimeout(initial)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('murivest:notifications-changed', onStream)
    }
  }, [load])

  useEffect(() => {
    if (open && push === null) void getPushState().then(setPush)
  }, [open, push])

  const merged = offline && items.length === 0 ? cached : items
  const unread = merged.filter((n) => !n.readAt).length
  const visible = useMemo(() => (tab === 'unread' ? merged.filter((n) => !n.readAt) : merged), [tab, merged])

  const groups = useMemo(() => {
    const map = new Map<string, FeedItem[]>()
    for (const n of visible) {
      const label = dateGroupLabel(n.createdAt)
      const list = map.get(label) ?? []
      list.push(n)
      map.set(label, list)
    }
    return [...map.entries()]
  }, [visible])

  async function markAll() {
    setBusy(true)
    const unreadIds = merged.filter((n) => !n.readAt).map((n) => n.id)
    for (const id of unreadIds) queueReadMarker(id)
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({all: true}),
    }).catch(() => {})
    await load()
    setBusy(false)
  }

  async function markRead(id: string) {
    queueReadMarker(id)
    setItems((prev) => prev.map((n) => (n.id === id ? {...n, readAt: new Date().toISOString()} : n)))
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ids: [id]}),
    }).catch(() => {})
  }

  async function handleEnablePush() {
    setPushBusy(true)
    const result = await enablePush()
    setPushBusy(false)
    if (result.ok) {
      setPush(await getPushState())
      setPushPromptDismissed(true)
    } else if (result.reason) {
      setPushPromptDismissed(true)
    }
  }

  const showPushPrompt =
    push !== null && push.supported && push.configured && !push.subscribed && push.permission === 'default' && !pushPromptDismissed

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        className="press-scale rounded-standard relative inline-flex h-9 w-9 items-center justify-center border border-border text-primary transition-colors hover:border-gold hover:text-gold"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="rounded-pill absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center bg-gold px-1 text-[9px] font-bold text-forest-deep">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button type="button" aria-label="Close notifications" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="rounded-card absolute right-5 top-[4.5rem] z-50 w-80 max-w-[calc(100vw-2.5rem)] border border-border bg-card shadow-overlay sm:w-96">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Notifications</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={markAll}
                  disabled={busy || unread === 0}
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-gold disabled:opacity-40"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
                <Link
                  href={settingsHref}
                  onClick={() => setOpen(false)}
                  aria-label="Notification settings"
                  className="text-muted-foreground transition-colors hover:text-gold"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="flex border-b border-border">
              {(['unread', 'all'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 px-4 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors',
                    tab === t ? 'border-b-2 border-gold font-semibold text-primary' : 'text-muted-foreground hover:text-primary',
                  )}
                >
                  {t === 'unread' ? `Unread${unread > 0 ? ` (${unread > 9 ? '9+' : unread})` : ''}` : 'All'}
                </button>
              ))}
            </div>

            {showPushPrompt ? (
              <div className="flex items-start gap-3 border-b border-border bg-gold/5 px-4 py-3">
                <MonitorSmartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium leading-snug text-primary">Enable push notifications</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    Get delivery and document alerts on this device — even when the portal is closed.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleEnablePush}
                      disabled={pushBusy}
                      className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold hover:underline disabled:opacity-50"
                    >
                      {pushBusy ? 'Enabling…' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPushPromptDismissed(true)}
                      className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
                    >
                      Not now
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setPushPromptDismissed(true)} aria-label="Dismiss" className="text-muted-foreground/60 hover:text-primary">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}

            <div className="portal-scroll dropdown-max-h overflow-y-auto">
              {groups.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="mx-auto mb-3 h-8 w-8 text-gold/40" strokeWidth={1.25} />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {tab === 'unread'
                      ? 'Nothing unread. New document, order, mandate and security signals will appear here.'
                      : 'No notifications yet. Order updates, mandate progress, document readiness and new matches will appear here.'}
                  </p>
                </div>
              ) : (
                groups.map(([label, rows]) => (
                  <div key={label}>
                    <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm">
                      {label}
                      {offline ? <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">· offline copy</span> : null}
                    </div>
                    <ul className="divide-y divide-border">
                      {rows.map((n) => {
                        const Icon = CATEGORY_ICONS[n.category] ?? Megaphone
                        const unreadRow = !n.readAt
                        return (
                          <li key={n.id} className={cn('px-4 py-3', unreadRow && 'bg-gold/5')}>
                            <div className="flex items-start gap-3">
                              <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', CATEGORY_ACCENTS[n.category] ?? 'text-muted-foreground')} strokeWidth={1.75} />
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (unreadRow) void markRead(n.id)
                                    setOpen(false)
                                  }}
                                  className="w-full text-left"
                                >
                                  <div className={cn('text-xs', unreadRow ? 'font-semibold text-primary' : 'font-normal text-muted-foreground')}>{n.title}</div>
                                  {n.body ? <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.body}</p> : null}
                                  <div className="mt-1 flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
                                    <span>{relativeTime(n.createdAt)}</span>
                                    {n.priority === 'critical' ? <span className="text-[#9C3B2E]">Priority</span> : null}
                                  </div>
                                </button>
                              </div>
                              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                                {n.link ? (
                                  <Link
                                    href={n.link}
                                    onClick={() => {
                                      if (unreadRow) void markRead(n.id)
                                      setOpen(false)
                                    }}
                                    className="text-[10px] uppercase tracking-[0.12em] text-gold hover:underline"
                                  >
                                    View
                                  </Link>
                                ) : null}
                                {unreadRow ? (
                                  <button
                                    type="button"
                                    onClick={() => void markRead(n.id)}
                                    aria-label="Mark as read"
                                    className="text-muted-foreground/50 transition-colors hover:text-gold"
                                  >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
              <Link
                href={settingsHref}
                onClick={() => setOpen(false)}
                className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-gold"
              >
                Notification settings →
              </Link>
              <Link
                href={activityHref}
                onClick={() => setOpen(false)}
                className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-gold"
              >
                All activity →
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
