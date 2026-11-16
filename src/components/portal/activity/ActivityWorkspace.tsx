'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Send, Loader2, MessagesSquare} from 'lucide-react'
import {fmtDateTime, humanizeStatus, relativeTime} from '@/lib/format'
import {StatusBadge} from '@/components/brand/primitives'
import {cn} from '@/lib/utils'

export interface TimelineItem {
  kind: string
  ref: string
  title: string
  detail?: string | null
  occurredAt: string
  status?: string
}

export interface ThreadRow {
  id: string
  subject: string
  status: string
  createdAt: string
  updatedAt: string
  sanityOpportunityId: string | null
  opportunityTitle: string | null
  messages: {id: string; senderType: string; body: string; createdAt: string; readAt: string | null}[]
}

const input = 'w-full rounded-standard border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground'

const KIND_LABEL: Record<string, string> = {
  order: 'Order',
  enquiry: 'Enquiry',
  mandate: 'Mandate',
  document_view: 'Document access',
  scenario: 'Studio scenario',
  security_event: 'Security',
  notification: 'Signal',
  payment: 'Payment',
}

export default function ActivityWorkspace({
  timeline,
  threads,
  advisorName,
}: {
  timeline: TimelineItem[]
  threads: ThreadRow[]
  advisorName: string | null
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'timeline' | 'threads'>(threads.length > 0 ? 'threads' : 'timeline')
  const [activeThread, setActiveThread] = useState<string | null>(threads[0]?.id ?? null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [error, setError] = useState('')

  const thread = threads.find((t) => t.id === activeThread) ?? null

  async function sendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!thread || reply.trim().length < 1) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({enquiryId: thread.id, body: reply.trim()}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not send the message.')
        return
      }
      setReply('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function newThread(e: React.FormEvent) {
    e.preventDefault()
    if (newSubject.trim().length < 3 || newBody.trim().length < 10) {
      setError('Add a subject and a message (10+ characters).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({subject: newSubject.trim(), message: newBody.trim()}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not send the enquiry.')
        return
      }
      setNewSubject('')
      setNewBody('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-6 inline-flex rounded-pill border border-border bg-card p-1 text-center text-[11px] uppercase tracking-[0.14em] shadow-card" role="tablist">
        {(
          [
            ['threads', `Advisor threads (${threads.length})`],
            ['timeline', `Activity timeline (${timeline.length})`],
          ] as const
        ).map(([key, lbl]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn('rounded-pill px-5 py-2.5 transition-colors', tab === key ? 'bg-gold/10 font-semibold text-primary' : 'text-muted-foreground hover:text-primary')}>
            {lbl}
          </button>
        ))}
      </div>

      {error ? <div className="mb-5 border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}

      {tab === 'threads' ? (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Thread list */}
          <div className="min-w-0 rounded-card border border-border bg-card shadow-card">
            {threads.length === 0 ? (
              <p className="p-6 text-xs leading-relaxed text-muted-foreground">
                No threads yet. Start one below{advisorName ? ` — ${advisorName} responds for the Murivest desk` : ''}.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {threads.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setActiveThread(t.id)} className={cn('w-full px-4 py-3.5 text-left transition-colors', activeThread === t.id ? 'bg-gold/10' : 'hover:bg-secondary/50')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-primary">{t.subject}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {t.messages.length} messages · {relativeTime(t.updatedAt)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active thread */}
          <div className="flex min-w-0 flex-col rounded-card border border-border bg-card shadow-card">
            {thread ? (
              <>
                <div className="border-b border-border px-6 py-4">
                  <h3 className="font-display text-lg text-primary">{thread.subject}</h3>
                  {thread.opportunityTitle ? <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Re: {thread.opportunityTitle}</div> : null}
                </div>
                <div className="portal-scroll max-h-96 flex-1 overflow-y-auto px-6 py-4">
                  {thread.messages.map((m) => (
                    <div key={m.id} className={cn('mb-4 max-w-[85%]', m.senderType === 'investor' ? 'ml-auto' : '')}>
                      <div
                        className={cn(
                          'px-4 py-3 text-sm leading-relaxed',
                          m.senderType === 'investor' ? 'bg-primary text-primary-foreground' : m.senderType === 'advisor' ? 'bg-gold/10 text-primary' : 'bg-secondary text-primary',
                        )}
                      >
                        <div className="mb-1 text-[9px] uppercase tracking-[0.14em] opacity-70">
                          {m.senderType === 'investor' ? 'You' : m.senderType === 'advisor' ? advisorName || 'Murivest advisor' : 'Murivest'}
                          {' · '}
                          {fmtDateTime(m.createdAt)}
                        </div>
                        {m.body}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendReply} className="border-t border-border p-4">
                  <div className="flex gap-2">
                    <input className="rounded-standard border border-border bg-background px-4 py-2.5 text-sm focus:border-primary flex-1" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to your advisor…" maxLength={4000} />
                    <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10">
                <MessagesSquare className="mb-3 h-10 w-10 text-gold/40" />
                <p className="text-xs text-muted-foreground">Select a thread, or start a new enquiry below.</p>
              </div>
            )}
          </div>

          {/* New enquiry */}
          <form onSubmit={newThread} className="rounded-card border border-border bg-card shadow-card p-6 lg:col-span-2">
            <h3 className="mb-4 font-display text-lg text-primary">New enquiry to the desk</h3>
            <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
              <label className="block sm:col-span-2">
                <span className={label}>Subject</span>
                <input className={input} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} maxLength={200} placeholder="e.g. Westlands office — data room access" />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Message</span>
                <textarea className={`${input} min-h-24`} value={newBody} onChange={(e) => setNewBody(e.target.value)} maxLength={4000} />
              </label>
            </div>
            <button type="submit" disabled={busy} className="mt-4 inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send enquiry
            </button>
          </form>
        </div>
      ) : (
        <ol className="relative border-l border-gold/30 pl-6">
          {timeline.length === 0 ? (
            <li className="text-xs leading-relaxed text-muted-foreground">No activity yet — orders, enquiries, mandates, document access and security events will build your timeline here.</li>
          ) : (
            timeline.map((item, i) => (
              <li key={`${item.kind}-${item.ref}-${i}`} className="mb-6">
                <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rotate-45 border border-gold/60 bg-background" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] uppercase tracking-[0.16em] text-gold/80">{KIND_LABEL[item.kind] || humanizeStatus(item.kind)}</span>
                  <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">{fmtDateTime(item.occurredAt)}</span>
                  {item.status ? <StatusBadge status={item.status} /> : null}
                </div>
                <div className="mt-1 text-sm font-medium text-primary">{item.title}</div>
                {item.detail ? <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.detail}</div> : null}
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  )
}
