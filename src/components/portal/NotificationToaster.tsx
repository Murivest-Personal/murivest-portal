'use client'

import {useEffect, useRef, useState, useCallback} from 'react'
import {useRouter} from 'next/navigation'
import {
  FolderLock,
  ClipboardList,
  Search,
  Calculator,
  ScrollText,
  MessagesSquare,
  ShieldCheck,
  Megaphone,
  X,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import {queueReadMarker} from '@/lib/client/notification-store'

/**
 * Real-time in-app notifications (spec §4):
 *  • subtle, non-blocking toasts while the investor is active (auto-dismiss,
 *    one quiet action button, hover pauses the timer);
 *  • a sparingly-used modal for high-importance events — Brief Delivered,
 *    Verification Approved / Access Tier changed, security-critical alerts.
 *
 * Fed by the SSE stream (/api/notifications/stream). When the tab is closed
 * the stream ends and background delivery continues via Web Push + email.
 */

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

/** Events that justify interrupting deep work (kept deliberately short). */
const MODAL_EVENTS = new Set(['order.delivered', 'security.verification_update', 'security.tier_changed'])

interface StreamNotification {
  id: string
  category: string
  event?: string | null
  priority: string
  title: string
  body: string | null
  link: string | null
  createdAt: string
}

interface Toast extends StreamNotification {
  expiresAt: number
}

const TOAST_MS = 6500
const MAX_TOASTS = 3

export default function NotificationToaster() {
  const router = useRouter()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [modal, setModal] = useState<StreamNotification | null>(null)
  const shownRef = useRef<Set<string>>(new Set())

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const markRead = useCallback((id: string) => {
    queueReadMarker(id)
    void fetch('/api/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ids: [id]}),
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    let stopped = false

    const handle = (n: StreamNotification) => {
      if (shownRef.current.has(n.id)) return
      shownRef.current.add(n.id)

      // The bell refreshes its badge & centre from this event.
      window.dispatchEvent(new CustomEvent('murivest:notifications-changed'))

      if (MODAL_EVENTS.has(n.event ?? '') || n.priority === 'critical') {
        setModal((current) => current ?? n)
      } else {
        setToasts((prev) => [...prev.slice(-MAX_TOASTS + 1), {...n, expiresAt: Date.now() + TOAST_MS}])
      }
    }

    const connect = () => {
      if (stopped) return
      try {
        es = new EventSource('/api/notifications/stream')
        es.addEventListener('notification', (ev) => {
          try {
            handle(JSON.parse((ev as MessageEvent).data) as StreamNotification)
          } catch {
            /* malformed frame — ignore */
          }
        })
        es.addEventListener('read', () => window.dispatchEvent(new CustomEvent('murivest:notifications-changed')))
        es.onerror = () => {
          // EventSource reconnects automatically; close long-dead sockets so
          // a signed-out tab does not hold connections open.
          if (stopped) es?.close()
        }
      } catch {
        /* SSE unavailable — the bell's polling still updates the centre */
      }
    }

    connect()
    return () => {
      stopped = true
      es?.close()
    }
  }, [])

  // Auto-dismiss timers.
  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setToasts((prev) => prev.filter((t) => t.expiresAt > now))
    }, 500)
    return () => clearInterval(timer)
  }, [toasts.length])

  const openLink = useCallback(
    (n: StreamNotification, dismiss?: () => void) => {
      markRead(n.id)
      dismiss?.()
      router.push(n.link ?? '/portal')
    },
    [markRead, router],
  )

  return (
    <>
      {/* Toasts */}
      <div aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[22rem] max-w-[calc(100vw-3rem)] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = CATEGORY_ICONS[t.category] ?? Megaphone
          return (
            <div
              key={t.id}
              onMouseEnter={() => setToasts((prev) => prev.map((x) => (x.id === t.id ? {...x, expiresAt: Date.now() + TOAST_MS} : x)))}
              className="pointer-events-auto border border-border bg-card shadow-xl"
              role="status"
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-primary">{t.title}</p>
                  {t.body ? <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{t.body}</p> : null}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openLink(t, () => dismissToast(t.id))}
                      className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold hover:underline"
                    >
                      {ctaLabel(t)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        markRead(t.id)
                        dismissToast(t.id)
                      }}
                      className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
                    >
                      Mark read
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="flex-shrink-0 text-muted-foreground/60 hover:text-primary">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="h-0.5 w-full bg-border">
                <div
                  className="h-full bg-gold/70 transition-[width] duration-500 ease-linear"
                  style={{width: `${Math.max(0, Math.min(100, ((t.expiresAt - Date.now()) / TOAST_MS) * 100))}%`}}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* High-importance modal */}
      {modal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <button type="button" aria-label="Dismiss" onClick={() => setModal(null)} className="absolute inset-0 bg-forest-deep/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md border border-border bg-card shadow-2xl" role="alertdialog" aria-modal="true">
            <div className="flex items-start gap-4 px-6 py-6">
              {(() => {
                const Icon = CATEGORY_ICONS[modal.category] ?? ShieldCheck
                return <Icon className="mt-1 h-6 w-6 flex-shrink-0 text-gold" strokeWidth={1.5} />
              })()}
              <div className="min-w-0">
                <h2 className="font-display text-lg leading-snug text-primary">{modal.title}</h2>
                {modal.body ? <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{modal.body}</p> : null}
                <div className="mt-5 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => openLink(modal, () => setModal(null))}
                    className="border border-forest bg-forest px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-forest-deep"
                  >
                    {ctaLabel(modal)}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(modal.id)
                      setModal(null)
                    }}
                    className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ctaLabel(n: StreamNotification): string {
  switch (n.category) {
    case 'documents':
      return 'View document'
    case 'orders':
      return 'Open order'
    case 'mandates':
      return 'Open mandate'
    case 'messages':
      return 'Read message'
    case 'security':
      return 'Review security'
    case 'opportunities':
      return 'Review opportunity'
    default:
      return 'Open portal'
  }
}
