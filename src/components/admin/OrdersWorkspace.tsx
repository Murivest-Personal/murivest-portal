'use client'

import {useCallback, useEffect, useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Download, Loader2, Search} from 'lucide-react'
import {fmtMoney, fmtNumber, relativeTime} from '@/lib/format'
import {adminAction, adminData, inputClass} from './client'
import {SectionCard, StatusPill, DataTable, EmptyState} from './ui'

export interface OrderRow {
  id: string
  reference: string
  userId: string
  investorName: string
  investorEmail: string
  investorClass: string
  investorTier: string
  organisationName: string | null
  briefTitle: string
  briefType: string
  briefSource: string
  format: string
  customScope: string | null
  status: string
  priority: string
  assignedToId: string | null
  amountUsd: number
  amountKes: number
  currency: string
  createdAt: string
  dueAt: string | null
  deliveredAt: string | null
  payment: {id: string; status: string; method: string | null; amountUsd: number; amountKes: number; reference: string | null; createdAt: string} | null
  hasVerifiedPayment: boolean
}

const NEXT_STATUS: Record<string, string[]> = {
  pending: ['awaiting_payment', 'payment_confirmed', 'cancelled'],
  awaiting_payment: ['payment_confirmed', 'cancelled'],
  payment_confirmed: ['processing', 'cancelled'],
  processing: ['internal_review', 'ready', 'cancelled'],
  internal_review: ['ready', 'processing'],
  ready: ['delivered', 'cancelled'],
  delivered: ['closed'],
  closed: [],
  cancelled: [],
}

const STATUS_FILTERS = [
  {value: '', label: 'All statuses'},
  {value: 'open', label: 'Open (pipeline)'},
  {value: 'pending', label: 'Pending'},
  {value: 'awaiting_payment', label: 'Awaiting payment'},
  {value: 'payment_confirmed', label: 'Payment confirmed'},
  {value: 'processing', label: 'In progress'},
  {value: 'internal_review', label: 'Internal review'},
  {value: 'ready', label: 'Ready'},
  {value: 'delivered', label: 'Delivered'},
  {value: 'closed', label: 'Closed'},
  {value: 'cancelled', label: 'Cancelled'},
]

export default function OrdersWorkspace({
  initial,
  initialStatus,
  canManage,
  canVerifyPayments,
  canExport,
  staffId,
}: {
  initial: OrderRow[]
  initialStatus: string
  canManage: boolean
  canVerifyPayments: boolean
  canExport: boolean
  staffId: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [status, setStatus] = useState(initialStatus || '')
  const [q, setQ] = useState('')
  const [priority, setPriority] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminData<{orders: OrderRow[]}>('orders', {
      ...(status ? {status} : {}),
      ...(q ? {q} : {}),
      ...(priority ? {priority} : {}),
      ...(assignedTo ? {assignedTo} : {}),
    })
    if (res.ok && res.data) setRows(res.data.orders)
    setLoading(false)
  }, [status, q, priority, assignedTo])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [load])

  async function act(orderId: string, action: string, payload: Record<string, unknown>) {
    setBusyId(orderId)
    setError('')
    const res = await adminAction(action, payload)
    setBusyId(null)
    if (!res.ok) {
      setError(res.error ?? 'Action failed.')
      return
    }
    await load()
    router.refresh()
  }

  const openValue = rows.filter((r) => ['pending','awaiting_payment','payment_confirmed','processing','internal_review','ready'].includes(r.status)).reduce((a, r) => a + r.amountUsd, 0)
  const needsPayment = rows.filter((r) => r.payment?.status === 'submitted').length
  const unassigned = rows.filter((r) => !r.assignedToId && ['payment_confirmed','processing','internal_review','ready'].includes(r.status)).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="Orders listed" value={fmtNumber(rows.length)} />
        <Tile label="Open pipeline value" value={fmtMoney(openValue)} />
        <Tile label="Payments to verify" value={fmtNumber(needsPayment)} />
        <Tile label="Unassigned in fulfilment" value={fmtNumber(unassigned)} />
      </div>

      <SectionCard
        title="Orders queue"
        description="Private & institutional briefs — creation → payment → fulfilment → delivery → close"
        actions={
          <>
            {loading ? <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">refreshing…</span> : null}
            {canExport ? (
              <a href="/api/admin/export?dataset=orders" className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                <Download className="h-3 w-3" /> CSV
              </a>
            ) : null}
          </>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input className={`${inputClass} pl-9`} placeholder="Reference, brief, investor…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
          </div>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter priority">
            <option value="">All priorities</option>
            {['urgent', 'high', 'normal', 'low'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} aria-label="Filter assignment">
            <option value="">All assignments</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>

        {error ? <div className="mb-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

        {rows.length === 0 ? (
          <EmptyState title="No orders in this view" description="Investor brief orders land here the moment they are placed." />
        ) : (
          <DataTable head={['Order', 'Investor', 'Brief', 'Status', 'Payment', 'Amount', 'Fulfilment']}>
            {rows.map((r) => {
              const next = NEXT_STATUS[r.status] ?? []
              return (
                <tr key={r.id} className="group hover:bg-accent/30">
                  <td className="pl-0 pr-3 align-top">
                    <Link href={`/admin/orders/${r.id}`} className="font-medium text-primary group-hover:text-gold">{r.reference}</Link>
                    <div className="text-[10px] text-muted-foreground">{relativeTime(r.createdAt)}</div>
                    {r.priority !== 'normal' ? <div className="mt-1"><StatusPill status={r.priority === 'urgent' ? 'flagged' : 'under_offer'} label={r.priority} /></div> : null}
                  </td>
                  <td className="px-3 align-top">
                    <Link href={`/admin/investors/${r.userId}`} className="text-xs font-medium text-primary hover:text-gold">{r.investorName}</Link>
                    <div className="text-[10px] text-muted-foreground">
                      {r.investorClass === 'uhnwi' ? 'UHNWI' : r.investorClass === 'institutional_rep' ? 'Institutional' : 'Individual'} · {r.investorTier.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-3 align-top">
                    <div className="max-w-56 truncate text-xs text-primary" title={r.briefTitle}>{r.briefTitle}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.briefType.replace(/_/g, ' ')} · {r.briefSource.replace(/_/g, ' ')} · {r.format.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td className="px-3 align-top"><StatusPill status={r.status} /></td>
                  <td className="px-3 align-top">
                    {r.payment ? (
                      <>
                        <StatusPill status={r.payment.status === 'verified' ? 'verified' : r.payment.status === 'rejected' ? 'rejected' : 'pending'} label={r.payment.status} />
                        <div className="mt-1 text-[10px] text-muted-foreground">{r.payment.method ?? '—'}{r.payment.reference ? ` · ${r.payment.reference.slice(0, 12)}` : ''}</div>
                      </>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">none yet</span>
                    )}
                  </td>
                  <td className="px-3 align-top text-xs tabular-nums">{fmtMoney(r.amountUsd, 'USD', {compact: true})}</td>
                  <td className="px-3 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {canVerifyPayments && r.payment?.status === 'submitted' ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => act(r.payment!.id, 'payment.verify', {paymentId: r.payment!.id, decision: 'verified'})}
                          className="border border-forest/40 bg-forest/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60"
                        >
                          {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Verify payment'}
                        </button>
                      ) : null}
                      {canManage && next.length > 0 && next[0] !== 'cancelled' ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, 'order.status', {orderId: r.id, status: next[0]})}
                          className="border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60"
                        >
                          → {next[0].replace(/_/g, ' ')}
                        </button>
                      ) : null}
                      {canManage && !r.assignedToId && ['payment_confirmed', 'processing', 'internal_review', 'ready'].includes(r.status) ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => act(r.id, 'order.assign', {orderId: r.id, assignedToId: staffId})}
                          className="border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60"
                        >
                          Assign to me
                        </button>
                      ) : null}
                      <Link href={`/admin/orders/${r.id}`} className="border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary hover:border-gold hover:text-gold">
                        Open
                      </Link>
                    </div>
                    {r.dueAt ? <div className="mt-1 text-[10px] text-gold-deep">due {relativeTime(r.dueAt)}</div> : null}
                  </td>
                </tr>
              )
            })}
          </DataTable>
        )}
      </SectionCard>
    </div>
  )
}

function Tile({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-card border border-border bg-card shadow-card p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl text-primary tabular-nums">{value}</div>
    </div>
  )
}
