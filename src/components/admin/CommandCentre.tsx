'use client'

import {useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {UsersRound, ClipboardList, ScrollText, Map, Landmark, Megaphone, ArrowUpRight, Loader2} from 'lucide-react'
import {fmtMoney, fmtNumber, relativeTime} from '@/lib/format'
import {adminAction} from './client'
import {inputClass, labelClass} from './client'
import RevenueCard, {type RevenueCardData} from './RevenueCard'
import {MetricTile, SectionCard, StatusPill, EmptyState} from './ui'

export interface CommandCentreProps {
  revenue: RevenueCardData
  executive: {
    activeInvestors: {total: number; uhnwi: number; institutional: number; individual: number}
    newRegistrations: {current: number; previous: number; growthPct: number | null}
    verificationConversionPct: number | null
    activeMandates: number
    opportunities: {live: number; offMarket: number; auction: number; underOffer: number; total: number; source: string}
    openOrders: {count: number; valueUsd: number}
    avgFulfilmentHours: number | null
    pipeline: {weightedUsd: number; unweightedUsd: number}
    revenueUsd: number
    aovUsd: number | null
  }
  queues: {
    pendingVerifications: {userId: string; name: string; email: string; verificationStatus: string; kycStatus: string; accessTier: string; waitingDays: number}[]
    openOrders: {id: string; reference: string; briefTitle: string; status: string; priority: string; amountUsd: number; currency: string; createdAt: string; dueAt: string | null; assigned: boolean; paid: boolean}[]
    stalledMandates: {id: string; reference: string; title: string; stage: string; probability: number; nextAction: string | null; nextActionDue: string | null; daysSinceUpdate: number}[]
    openEnquiries: {id: string; subject: string; createdAt: string; awaitingReply: boolean}[]
  }
  activity: {id: string; action: string; entity: string | null; entityId: string | null; actorName: string; actorType: string; createdAt: string}[]
  quickActions: {paymentsToVerify: number; ordersToAssign: number; docRequestsPending: number; newEnquiries: number}
  can: {broadcast: boolean; orders: boolean; investors: boolean; compliance: boolean; mandates: boolean}
}

export default function CommandCentre(props: CommandCentreProps) {
  const {executive: exec, queues, activity, quickActions, can} = props
  const router = useRouter()

  return (
    <div className="space-y-8">
      {/* Revenue Card — permanent, prominent */}
      <RevenueCard initial={props.revenue} variant="compact" canExport />

      {/* Key metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricTile
          label="Active investors"
          value={fmtNumber(exec.activeInvestors.total)}
          sub={`${exec.activeInvestors.uhnwi} UHNWI · ${exec.activeInvestors.institutional} institutional`}
          icon={<UsersRound className="h-4 w-4" strokeWidth={1.75} />}
        />
        <MetricTile label="New registrations" value={fmtNumber(exec.newRegistrations.current)} sub={`${exec.newRegistrations.previous} in prior period`} trend={exec.newRegistrations.growthPct} />
        <MetricTile
          label="Open orders"
          value={fmtNumber(exec.openOrders.count)}
          sub={fmtMoney(exec.openOrders.valueUsd)}
          icon={<ClipboardList className="h-4 w-4" strokeWidth={1.75} />}
        />
        <MetricTile label="Active mandates" value={fmtNumber(exec.activeMandates)} sub={`weighted pipeline ${fmtMoney(exec.pipeline.weightedUsd)}`} icon={<ScrollText className="h-4 w-4" strokeWidth={1.75} />} />
        <MetricTile
          label="Opportunities live"
          value={fmtNumber(exec.opportunities.live)}
          sub={`${exec.opportunities.offMarket} off-market · ${exec.opportunities.auction} auction`}
          icon={<Map className="h-4 w-4" strokeWidth={1.75} />}
        />
        <MetricTile label="Verification conversion" value={exec.verificationConversionPct != null ? `${exec.verificationConversionPct}%` : '—'} sub="registered → verified" icon={<Landmark className="h-4 w-4" strokeWidth={1.75} />} />
      </div>

      {/* Quick actions */}
      <SectionCard title="Quick actions" description="Highest-leverage moves right now">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {can.orders ? (
            <QuickAction href="/admin/orders?status=awaiting_payment" label="Verify payments" badge={quickActions.paymentsToVerify} />
          ) : null}
          {can.orders ? <QuickAction href="/admin/orders?status=payment_confirmed" label="Assign orders" badge={quickActions.ordersToAssign} /> : null}
          {can.compliance ? <QuickAction href="/admin/compliance" label="Review verifications" badge={queues.pendingVerifications.length} /> : null}
          {can.orders ? <QuickAction href="/admin/documents" label="Document requests" badge={quickActions.docRequestsPending} /> : null}
          {can.broadcast ? <BroadcastAction /> : null}
        </div>
      </SectionCard>

      {/* Priority queues */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Pending verifications"
          description="Investors waiting in the KYC / verification pipeline"
          actions={can.compliance ? <QueueMore href="/admin/compliance" /> : undefined}
        >
          {queues.pendingVerifications.length === 0 ? (
            <EmptyState title="Verification queue is clear" description="No investors are waiting on KYC or profile review." />
          ) : (
            <ul className="divide-y divide-border/60">
              {queues.pendingVerifications.slice(0, 6).map((v) => (
                <li key={v.userId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/admin/investors/${v.userId}`} className="truncate text-sm font-medium text-primary hover:text-gold">
                      {v.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <StatusPill status={v.verificationStatus} />
                      <span>{v.waitingDays}d waiting</span>
                      <span>{v.accessTier.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <ArrowLink href={`/admin/investors/${v.userId}`} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Open orders" description="Fulfilment pipeline — oldest and highest priority first" actions={can.orders ? <QueueMore href="/admin/orders?status=open" /> : undefined}>
          {queues.openOrders.length === 0 ? (
            <EmptyState title="No open orders" description="New brief orders appear here the moment investors place them." />
          ) : (
            <ul className="divide-y divide-border/60">
              {queues.openOrders.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/admin/orders/${o.id}`} className="truncate text-sm font-medium text-primary hover:text-gold">
                      {o.reference} · {o.briefTitle}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <StatusPill status={o.status} />
                      {o.priority !== 'normal' ? <StatusPill status={o.priority === 'urgent' ? 'flagged' : 'under_offer'} label={o.priority} /> : null}
                      {o.paid ? <span className="text-forest">paid</span> : <span className="text-gold-deep">payment pending</span>}
                      <span>{fmtMoney(o.amountUsd, o.currency === 'KES' ? 'KES' : 'USD')}</span>
                    </div>
                  </div>
                  <ArrowLink href={`/admin/orders/${o.id}`} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Mandates needing attention" description="Active mandates without recent movement" actions={can.mandates ? <QueueMore href="/admin/mandates?status=active" /> : undefined}>
          {queues.stalledMandates.length === 0 ? (
            <EmptyState title="No stalled mandates" description="Active mandates with fresh updates stay off this queue." />
          ) : (
            <ul className="divide-y divide-border/60">
              {queues.stalledMandates.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href="/admin/mandates" className="truncate text-sm font-medium text-primary hover:text-gold">
                      {m.reference} · {m.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <StatusPill status={m.stage} />
                      <span>{m.probability}% win</span>
                      <span>{m.daysSinceUpdate}d since update</span>
                      {m.nextAction ? <span className="text-gold-deep">next: {m.nextAction}</span> : null}
                    </div>
                  </div>
                  <ArrowLink href="/admin/mandates" />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Unanswered messages" description="Enquiries awaiting a first advisor reply" actions={<QueueMore href="/admin/communications" />}>
          {queues.openEnquiries.length === 0 ? (
            <EmptyState title="Inbox is clear" description="Every open enquiry has been answered." />
          ) : (
            <ul className="divide-y divide-border/60">
              {queues.openEnquiries.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href="/admin/communications" className="truncate text-sm font-medium text-primary hover:text-gold">
                      {e.subject}
                    </Link>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {relativeTime(e.createdAt)} · {e.awaitingReply ? 'awaiting first reply' : 'open'}
                    </div>
                  </div>
                  <ArrowLink href="/admin/communications" />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Recent activity feed */}
      <SectionCard title="Recent activity" description="Audit-logged actions across the platform (latest 20)">
        {activity.length === 0 ? (
          <EmptyState title="No activity recorded yet" description="Sensitive actions across the portal are logged here." />
        ) : (
          <ul className="divide-y divide-border/60">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-primary">
                    <span className="font-medium">{a.actorName}</span>
                    <span className="text-muted-foreground"> · {a.action.replace(/\./g, ' → ')}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {a.entity ?? 'system'}
                    {a.entityId ? ` · ${a.entityId.slice(0, 18)}` : ''} · {a.actorType}
                  </div>
                </div>
                <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

function QuickAction({href, label, badge}: {href: string; label: string; badge: number}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-2 border border-border bg-card px-4 py-3 text-sm text-primary transition-colors hover:border-gold hover:bg-accent/40"
    >
      <span>{label}</span>
      <span className="inline-flex h-6 min-w-6 items-center justify-center bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground">{badge}</span>
    </Link>
  )
}

function QueueMore({href}: {href: string}) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:text-gold">
      View all <ArrowUpRight className="h-3 w-3" />
    </Link>
  )
}

function ArrowLink({href}: {href: string}) {
  return (
    <Link href={href} aria-label="Open" className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center border border-border text-primary transition-colors hover:border-gold hover:text-gold">
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  )
}

function BroadcastAction() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [audience, setAudience] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState<number | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await adminAction('broadcast.notify', {audience, title, body})
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Failed to send.')
      return
    }
    setSent(typeof res.recipients === 'number' ? res.recipients : 0)
    setTitle('')
    setBody('')
    router.refresh()
    setTimeout(() => {
      setOpen(false)
      setSent(null)
    }, 1600)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center justify-between gap-2 border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-primary transition-colors hover:border-gold hover:bg-gold/20"
      >
        <span className="inline-flex items-center gap-2">
          <Megaphone className="h-3.5 w-3.5 text-gold" /> Broadcast
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-forest-deep/80 backdrop-blur-sm">
          <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
            <div className="relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-lg sm:rounded-none">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-5 py-4 sm:px-6">
                <h2 className="font-display text-lg text-primary">Broadcast notification</h2>
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="p-2 text-muted-foreground hover:text-primary">
                  ✕
                </button>
              </div>
              <form onSubmit={send} className="overflow-y-auto px-5 py-5 sm:px-6">
                {sent != null ? (
                  <div className="mb-4 border border-forest/30 bg-forest/10 px-3 py-2 text-xs text-forest">Sent to {sent} investor{sent === 1 ? '' : 's'}.</div>
                ) : null}
                {error ? <div className="mb-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
                <div className="space-y-4">
                  <div>
                    <label className={labelClass} htmlFor="broadcast-audience">Audience</label>
                    <select id="broadcast-audience" value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass}>
                      <option value="all">All active investors</option>
                      <option value="verified">Verified investors</option>
                      <option value="tier_1">Tier 1 investors</option>
                      <option value="tier_2">Tier 2 investors</option>
                      <option value="tier_3">Tier 3 investors</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="broadcast-title">Title</label>
                    <input id="broadcast-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="e.g. New off-market opportunity" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="broadcast-body">Message</label>
                    <textarea id="broadcast-body" className={`${inputClass} min-h-24`} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={500} placeholder="Shown in the investor's notification bell." />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setOpen(false)} className="border border-border px-4 py-2 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-primary">
                      Cancel
                    </button>
                    <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Send
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
