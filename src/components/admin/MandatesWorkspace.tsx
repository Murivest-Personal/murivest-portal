'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Download, Loader2, Search} from 'lucide-react'
import {fmtMoney, fmtNumber, relativeTime} from '@/lib/format'
import {adminAction, adminData, inputClass} from './client'
import {SectionCard, StatusPill, DataTable, EmptyState} from './ui'

export interface MandateRow {
  id: string
  reference: string
  title: string
  status: string
  stage: string
  probability: number
  nextAction: string | null
  nextActionDue: string | null
  targetAllocationMin: number | null
  targetAllocationMax: number | null
  currency: string
  geographies: unknown
  assetClasses: unknown
  minNetYield: number | null
  targetIrr: number | null
  investorName: string
  investorEmail: string
  advisorId: string | null
  advisorName: string | null
  milestones: {id: string; title: string; status: string; dueDate: string | null}[]
  createdAt: string
  submittedAt: string | null
  activatedAt: string | null
  closedAt: string | null
  updatedAt: string
}

const STAGES = ['sourcing', 'qualification', 'matching', 'negotiation', 'closing', 'post_closing']

export default function MandatesWorkspace({
  initial,
  initialStatus,
  canManage,
  canExport,
  advisors,
}: {
  initial: MandateRow[]
  initialStatus: string
  canManage: boolean
  canExport: boolean
  advisors: {id: string; name: string}[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [status, setStatus] = useState(initialStatus || '')
  const [stage, setStage] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminData<{mandates: MandateRow[]}>('mandates', {
      ...(status ? {status} : {}),
      ...(stage ? {stage} : {}),
      ...(q ? {q} : {}),
    })
    if (res.ok && res.data) setRows(res.data.mandates)
    setLoading(false)
  }, [status, stage, q])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [load])

  async function update(mandateId: string, payload: Record<string, unknown>) {
    setBusyId(mandateId)
    setError('')
    const res = await adminAction('mandate.update', {mandateId, ...payload})
    setBusyId(null)
    if (!res.ok) {
      setError(res.error ?? 'Update failed.')
      return
    }
    await load()
    router.refresh()
  }

  const active = rows.filter((r) => r.status === 'active')
  const weighted = useMemo(
    () =>
      active.reduce((acc, m) => {
        if (m.currency !== 'USD' || (m.targetAllocationMin == null && m.targetAllocationMax == null)) return acc
        const mid = m.targetAllocationMin != null && m.targetAllocationMax != null ? (m.targetAllocationMin + m.targetAllocationMax) / 2 : (m.targetAllocationMin ?? m.targetAllocationMax ?? 0)
        return acc + mid * (m.probability / 100)
      }, 0),
    [active],
  )
  const unweighted = useMemo(
    () =>
      active.reduce((acc, m) => {
        if (m.currency !== 'USD' || (m.targetAllocationMin == null && m.targetAllocationMax == null)) return acc
        const mid = m.targetAllocationMin != null && m.targetAllocationMax != null ? (m.targetAllocationMin + m.targetAllocationMax) / 2 : (m.targetAllocationMin ?? m.targetAllocationMax ?? 0)
        return acc + mid
      }, 0),
    [active],
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="Mandates listed" value={fmtNumber(rows.length)} />
        <Tile label="Active" value={fmtNumber(active.length)} />
        <Tile label="Weighted pipeline" value={fmtMoney(weighted)} />
        <Tile label="Unweighted" value={fmtMoney(unweighted)} />
      </div>

      <SectionCard
        title="Mandate pipeline"
        description="Stage, probability and next actions — the acquisition pipeline at a glance"
        actions={
          <>
            {loading ? <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">refreshing…</span> : null}
            {canExport ? (
              <a href="/api/admin/export?dataset=mandates" className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                <Download className="h-3 w-3" /> CSV
              </a>
            ) : null}
          </>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input className={`${inputClass} pl-9`} placeholder="Reference or title…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search mandates" />
          </div>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
            <option value="">All statuses</option>
            {['draft', 'submitted', 'active', 'paused', 'closed', 'rejected'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select className={inputClass} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter stage">
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {error ? <div className="mb-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

        {rows.length === 0 ? (
          <EmptyState title="No mandates in this view" description="Investor acquisition mandates appear here once submitted." />
        ) : (
          <DataTable head={['Mandate', 'Investor', 'Allocation', 'Stage', 'Probability', 'Owner', 'Next action']}>
            {rows.map((m) => (
              <tr key={m.id} className="group hover:bg-accent/30">
                <td className="pl-0 pr-3 align-top">
                  <div className="font-medium text-primary">{m.reference}</div>
                  <div className="max-w-48 truncate text-xs text-muted-foreground" title={m.title}>{m.title}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusPill status={m.status} />
                    <span className="text-[10px] text-muted-foreground">upd. {relativeTime(m.updatedAt)}</span>
                  </div>
                </td>
                <td className="px-3 align-top text-xs">
                  <div className="text-primary">{m.investorName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {(Array.isArray(m.assetClasses) ? (m.assetClasses as string[]).slice(0, 2).join(', ') : 'any asset') || 'any asset'}
                    {m.minNetYield != null ? ` · ≥${m.minNetYield}% NY` : ''}
                    {m.targetIrr != null ? ` · IRR ${m.targetIrr}%` : ''}
                  </div>
                </td>
                <td className="px-3 align-top text-xs tabular-nums">
                  {m.targetAllocationMin != null || m.targetAllocationMax != null
                    ? `${m.targetAllocationMin != null ? fmtMoney(m.targetAllocationMin, m.currency, {compact: true}) : '—'} → ${m.targetAllocationMax != null ? fmtMoney(m.targetAllocationMax, m.currency, {compact: true}) : '—'}`
                    : <span className="text-muted-foreground">—</span>}
                  <div className="text-[10px] text-muted-foreground">{m.currency}</div>
                </td>
                <td className="px-3 align-top">
                  {canManage ? (
                    <select
                      className="rounded-standard border border-border bg-background px-2 py-1 text-xs focus:border-primary"
                      value={m.stage}
                      onChange={(e) => update(m.id, {stage: e.target.value})}
                      disabled={busyId === m.id}
                      aria-label={`Stage for ${m.reference}`}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusPill status={m.stage} />
                  )}
                </td>
                <td className="px-3 align-top">
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={m.probability}
                        onChange={(e) => setRows((prev) => prev.map((r) => (r.id === m.id ? {...r, probability: Number(e.target.value)} : r)))}
                        onMouseUp={(e) => update(m.id, {probability: Number((e.target as HTMLInputElement).value)})}
                        onTouchEnd={(e) => update(m.id, {probability: Number((e.target as HTMLInputElement).value)})}
                        className="w-20 accent-forest"
                        aria-label={`Probability for ${m.reference}`}
                      />
                      <span className="w-8 text-xs tabular-nums text-primary">{m.probability}%</span>
                    </div>
                  ) : (
                    <span className="text-xs tabular-nums">{m.probability}%</span>
                  )}
                </td>
                <td className="px-3 align-top">
                  {canManage ? (
                    <select
                      className="rounded-standard border border-border bg-background px-2 py-1 text-xs focus:border-primary"
                      value={m.advisorId ?? ''}
                      onChange={(e) => update(m.id, {advisorId: e.target.value || null})}
                      disabled={busyId === m.id}
                      aria-label={`Advisor for ${m.reference}`}
                    >
                      <option value="">Unassigned</option>
                      {advisors.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs">{m.advisorName ?? 'Unassigned'}</span>
                  )}
                </td>
                <td className="px-3 align-top">
                  <div className="max-w-44 truncate text-xs text-primary" title={m.nextAction ?? ''}>{m.nextAction ?? <span className="text-muted-foreground">—</span>}</div>
                  {m.nextActionDue ? <div className="text-[10px] text-gold-deep">due {relativeTime(m.nextActionDue)}</div> : null}
                  {canManage && ['submitted'].includes(m.status) ? (
                    <button type="button" disabled={busyId === m.id} onClick={() => update(m.id, {status: 'active'})} className="mt-1 border border-forest/40 bg-forest/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60">
                      Activate
                    </button>
                  ) : null}
                  {canManage && ['active', 'paused'].includes(m.status) ? (
                    <button type="button" disabled={busyId === m.id} onClick={() => update(m.id, {status: m.status === 'active' ? 'paused' : 'active'})} className="mt-1 border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60">
                      {m.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
          Weighted pipeline = midpoint of target allocation × win probability (active USD mandates). Probability and stage changes are audit-logged.
        </p>
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
