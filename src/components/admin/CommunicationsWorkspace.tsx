'use client'

import {useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Loader2, Reply} from 'lucide-react'
import {fmtDateTime, relativeTime} from '@/lib/format'
import {adminAction, inputClass} from './client'
import {SectionCard, StatusPill, EmptyState} from './ui'
import {cn} from '@/lib/utils'

export interface Thread {
  id: string
  userId: string
  investorName: string
  investorEmail: string
  investorClass: string
  tier: string
  assignedAdvisor: string | null
  assignedAdvisorName: string | null
  subject: string
  opportunityTitle: string | null
  status: string
  createdAt: string
  updatedAt: string
  messages: {id: string; senderType: string; senderName: string | null; body: string; createdAt: string}[]
  awaitingReply: boolean
  lastActivityAt: string
}

export default function CommunicationsWorkspace({initialThreads, canReply, initialStatus}: {initialThreads: Thread[]; canReply: boolean; initialStatus: string}) {
  const router = useRouter()
  const [threads, setThreads] = useState(initialThreads)
  const [status, setStatus] = useState(initialStatus || '')
  const [selectedId, setSelectedId] = useState(initialThreads[0]?.id ?? '')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function refresh() {
    const res = await fetch(`/api/admin/data?scope=communications${status ? `&status=${status}` : ''}`, {cache: 'no-store'})
    const data = await res.json().catch(() => null)
    if (data?.ok) setThreads(data.threads)
    router.refresh()
  }

  const selected = threads.find((t) => t.id === selectedId) ?? null

  async function send() {
    if (!selected || !reply.trim()) return
    setBusy(true)
    setError('')
    setMessage('')
    const res = await adminAction('message.reply', {enquiryId: selected.id, body: reply})
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Reply failed.')
      return
    }
    setReply('')
    setMessage('Reply sent — the investor has been notified.')
    await refresh()
  }

  async function close() {
    if (!selected) return
    setBusy(true)
    const res = await adminAction('enquiry.close', {enquiryId: selected.id})
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Failed to close.')
      return
    }
    await refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          {value: '', label: 'All threads'},
          {value: 'open', label: 'Open'},
          {value: 'responded', label: 'Responded'},
          {value: 'closed', label: 'Closed'},
        ].map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setStatus(f.value)
              const qs = f.value ? `?status=${f.value}` : ''
              window.history.replaceState(null, '', `/admin/communications${qs}`)
              void refresh()
            }}
            className={cn(
              'border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors',
              status === f.value ? 'border-gold bg-gold/10 text-primary' : 'border-border text-muted-foreground hover:text-primary',
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {threads.filter((t) => t.awaitingReply).length} awaiting first reply
        </span>
      </div>

      {message ? <div className="border border-forest/30 bg-forest/10 px-3 py-2 text-xs text-forest">{message}</div> : null}
      {error ? <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Thread list */}
        <SectionCard title="Inbox" description={`${threads.length} threads`}>
          {threads.length === 0 ? (
            <EmptyState title="No messages" description="Investor enquiries and advisor conversations appear here." />
          ) : (
            <ul className="max-h-[70vh] divide-y divide-border/60 overflow-y-auto">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={cn('w-full px-3 py-3 text-left transition-colors hover:bg-accent/30', selectedId === t.id && 'bg-accent/40')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-primary">{t.investorName}</span>
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">{relativeTime(t.lastActivityAt)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.subject}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusPill status={t.status} />
                      {t.awaitingReply ? <StatusPill status="flagged" label="awaiting reply" /> : null}
                      <span className="text-[10px] text-muted-foreground">{t.messages.length} msg</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Conversation */}
        <SectionCard
          title={selected ? selected.subject : 'Conversation'}
          description={
            selected
              ? `${selected.investorName} · ${selected.investorClass === 'uhnwi' ? 'UHNWI' : selected.investorClass === 'institutional_rep' ? 'Institutional' : 'Individual'} · ${selected.tier.replace('_', ' ')}${selected.opportunityTitle ? ` · re: ${selected.opportunityTitle}` : ''}`
              : undefined
          }
          actions={selected ? <Link href={`/admin/investors/${selected.userId}`} className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:text-gold">Investor record →</Link> : undefined}
        >
          {!selected ? (
            <EmptyState title="Select a thread" description="Choose a conversation from the inbox." />
          ) : (
            <>
              <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
                {selected.messages.map((m) => (
                  <div key={m.id} className={cn('border p-3', m.senderType === 'investor' ? 'border-border bg-card' : 'border-gold/30 bg-gold/5')}>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>{m.senderType === 'investor' ? selected.investorName : m.senderName ?? 'Murivest staff'}</span>
                      <span>{fmtDateTime(m.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-primary">{m.body}</p>
                  </div>
                ))}
                {selected.messages.length === 0 ? <p className="text-xs text-muted-foreground">No messages in this thread.</p> : null}
              </div>

              {canReply ? (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <textarea
                    className={`${inputClass} min-h-24`}
                    placeholder="Write a reply — sent to the investor's secure inbox with notification…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    aria-label="Reply"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {selected.assignedAdvisorName ? `Advisor of record: ${selected.assignedAdvisorName}` : 'No advisor assigned — set one on the investor record'}
                    </span>
                    <div className="flex gap-2">
                      {selected.status !== 'closed' ? (
                        <button type="button" disabled={busy} onClick={close} className="border border-border px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground hover:text-primary disabled:opacity-60">
                          Close thread
                        </button>
                      ) : null}
                      <button type="button" disabled={busy || !reply.trim()} onClick={send} className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Reply className="h-3.5 w-3.5" />} Send reply
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
