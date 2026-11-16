'use client'

import {useMemo, useState} from 'react'
import Link from 'next/link'
import {Columns3, Save, Trash2, Plus, X} from 'lucide-react'
import type {OpportunityDoc} from '@/lib/sanity/types'
import type {ScenarioInputs} from '@/lib/validation'
import {fmtMoney, fmtPct, fmtRatio, relativeTime} from '@/lib/format'
import {EmptyState, StatusBadge} from '@/components/brand/primitives'
import {assetClassLabel, structureLabel} from './OpportunityCard'
import {cn} from '@/lib/utils'

const selectCls = 'w-full border border-border bg-card px-3 py-2 text-xs text-foreground focus:border-primary'

export interface CompareOpportunity {
  doc: OpportunityDoc
  saved: boolean
}
export interface CompareScenario {
  id: string
  name: string
  inputs: ScenarioInputs
  summary: {totalCapitalRequirement?: number; equityRequired?: number; irrPct?: number | null; cashOnCashPct?: number | null; dscr?: number | null; equityMultiple?: number | null; capitalGap?: number} | null
  updatedAt: string
}
export interface SavedComparisonRow {
  id: string
  name: string
  sanityIds: string[]
  scenarioIds: string[]
  createdAt: string
}

const MAX_COLS = 4

export default function CompareWorkspace({
  opportunities,
  scenarios,
  savedComparisons,
  initialAddOpportunity,
  initialAddScenario,
}: {
  opportunities: CompareOpportunity[]
  scenarios: CompareScenario[]
  savedComparisons: SavedComparisonRow[]
  initialAddOpportunity?: string | null
  initialAddScenario?: string | null
}) {
  const [oppIds, setOppIds] = useState<string[]>(() => {
    const seed = initialAddOpportunity && opportunities.some((o) => o.doc._id === initialAddOpportunity) ? [initialAddOpportunity] : []
    return seed
  })
  const [scenIds, setScenIds] = useState<string[]>(() => {
    const seed = initialAddScenario && scenarios.some((s) => s.id === initialAddScenario) ? [initialAddScenario] : []
    return seed
  })
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<SavedComparisonRow[]>(savedComparisons)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedOpps = useMemo(() => opportunities.filter((o) => oppIds.includes(o.doc._id)).slice(0, MAX_COLS), [opportunities, oppIds])
  const selectedScens = useMemo(() => scenarios.filter((s) => scenIds.includes(s.id)).slice(0, MAX_COLS), [scenarios, scenIds])
  const columns = Math.min(selectedOpps.length + selectedScens.length, MAX_COLS)

  function toggleOpp(id: string) {
    setOppIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX_COLS)))
  }
  function toggleScen(id: string) {
    setScenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX_COLS)))
  }

  async function saveComparison() {
    if (columns === 0) {
      setNotice('Select at least one opportunity or scenario to compare.')
      return
    }
    if (!name.trim()) {
      setNotice('Name this comparison before saving.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/comparisons', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: name.trim(),
          sanityIds: oppIds,
          scenarioIds: scenIds,
          snapshot: {opportunities: selectedOpps.map((o) => o.doc), scenarios: selectedScens.map((s) => ({name: s.name, summary: s.summary}))},
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setSaved((prev) => [data.comparison, ...prev])
        setNotice('Comparison saved — it is available for later review below.')
        setName('')
      }
    } catch {
      setNotice('Could not save the comparison.')
    } finally {
      setBusy(false)
    }
  }

  async function removeComparison(id: string) {
    const res = await fetch(`/api/comparisons/${id}`, {method: 'DELETE'}).catch(() => null)
    if (res && res.ok) setSaved((prev) => prev.filter((c) => c.id !== id))
  }

  const rows: {label: string; cells: React.ReactNode[]}[] = []

  if (columns > 0) {
    rows.push({
      label: 'Type',
      cells: [
        ...selectedOpps.map((o) => (
          <StatusBadge key={o.doc._id} status={o.doc.status} />
        )),
        ...selectedScens.map((s) => (
          <span key={s.id} className="inline-flex items-center border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary">Studio scenario</span>
        )),
      ],
    })
    rows.push({
      label: 'Asset / market',
      cells: [
        ...selectedOpps.map((o) => (
          <span key={o.doc._id} className="text-xs text-muted-foreground">
            {assetClassLabel(o.doc.assetClass)} · {[o.doc.geography?.city, o.doc.geography?.country].filter(Boolean).join(', ')}
          </span>
        )),
        ...selectedScens.map((s) => (
          <span key={s.id} className="text-xs text-muted-foreground">{s.inputs.currency} analysis</span>
        )),
      ],
    })
    rows.push({
      label: 'Structure',
      cells: [
        ...selectedOpps.map((o) => <span key={o.doc._id} className="text-xs">{structureLabel(o.doc.dealStructure) || '—'}</span>),
        ...selectedScens.map((s) => (
          <span key={s.id} className="text-xs">{s.inputs.useDebt ? `${s.inputs.ltvPct}% LTV` : 'All-cash'}</span>
        )),
      ],
    })
    rows.push({
      label: 'Indicative price',
      cells: [
        ...selectedOpps.map((o) => (
          <span key={o.doc._id} className="tabular font-medium">{o.doc.indicativePrice?.amount != null ? fmtMoney(o.doc.indicativePrice.amount, o.doc.indicativePrice.currency || 'USD') : 'On application'}</span>
        )),
        ...selectedScens.map((s) => <span key={s.id} className="tabular font-medium">{fmtMoney(s.inputs.price, s.inputs.currency)}</span>),
      ],
    })
    rows.push({
      label: 'NOI (yr 1)',
      cells: [
        ...selectedOpps.map((o) => (
          <span key={o.doc._id} className="tabular">{o.doc.financials?.noi != null ? fmtMoney(o.doc.financials.noi, o.doc.financials.financialCurrency || 'USD') : '—'}</span>
        )),
        ...selectedScens.map((s) => <span key={s.id} className="tabular">{fmtMoney(s.inputs.grossIncome - s.inputs.opex, s.inputs.currency)}</span>),
      ],
    })
    rows.push({
      label: 'Net yield',
      cells: [
        ...selectedOpps.map((o) => <span key={o.doc._id} className="tabular">{o.doc.financials?.netYieldPct != null ? fmtPct(o.doc.financials.netYieldPct) : '—'}</span>),
        ...selectedScens.map((s) => {
          const netYield = s.inputs.price > 0 ? ((s.inputs.grossIncome - s.inputs.opex) / s.inputs.price) * 100 : null
          return <span key={s.id} className="tabular">{fmtPct(netYield)}</span>
        }),
      ],
    })
    rows.push({
      label: 'Occupancy',
      cells: [
        ...selectedOpps.map((o) => <span key={o.doc._id} className="tabular">{o.doc.financials?.occupancyPct != null ? fmtPct(o.doc.financials.occupancyPct, 1) : '—'}</span>),
        ...selectedScens.map(() => <span key="sc" />),
      ],
    })
    rows.push({
      label: 'Capital requirement',
      cells: [
        ...selectedOpps.map(() => <span key="opp-cr">On brief request</span>),
        ...selectedScens.map((s) => <span key={s.id} className="tabular font-medium">{fmtMoney(s.summary?.totalCapitalRequirement ?? null, s.inputs.currency)}</span>),
      ],
    })
    rows.push({
      label: 'Equity required',
      cells: [
        ...selectedOpps.map(() => <span key="opp-eq">On brief request</span>),
        ...selectedScens.map((s) => <span key={s.id} className="tabular">{fmtMoney(s.summary?.equityRequired ?? null, s.inputs.currency)}</span>),
      ],
    })
    rows.push({
      label: 'Levered IRR',
      cells: [
        ...selectedOpps.map(() => <span key="opp-irr">Model in Studio</span>),
        ...selectedScens.map((s) => <span key={s.id} className="tabular font-medium text-primary">{fmtPct(s.summary?.irrPct ?? null, 1)}</span>),
      ],
    })
    rows.push({
      label: 'Cash-on-cash',
      cells: [
        ...selectedOpps.map(() => <span key="opp-coc">Model in Studio</span>),
        ...selectedScens.map((s) => <span key={s.id} className="tabular">{fmtPct(s.summary?.cashOnCashPct ?? null, 1)}</span>),
      ],
    })
    rows.push({
      label: 'DSCR',
      cells: [
        ...selectedOpps.map(() => <span key="opp-dscr">Model in Studio</span>),
        ...selectedScens.map((s) => <span key={s.id} className="tabular">{fmtRatio(s.summary?.dscr ?? null)}</span>),
      ],
    })
    rows.push({
      label: 'Key risks',
      cells: [
        ...selectedOpps.map((o) => (
          <span key={o.doc._id} className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
            {o.doc.keyRisks?.slice(0, 2).join(' · ') || 'Published with the private brief.'}
          </span>
        )),
        ...selectedScens.map((s) => <span key={s.id} className="text-[11px] text-muted-foreground">Your assumptions — sensitivity-tested in Studio.</span>),
      ],
    })
    rows.push({
      label: '',
      cells: [
        ...selectedOpps.map((o) => (
          <div key={`act-${o.doc._id}`} className="flex flex-col gap-1.5">
            <Link href={`/portal/discover/${encodeURIComponent(o.doc._id)}`} className="border border-border px-2.5 py-1.5 text-center text-[10px] uppercase tracking-[0.1em] text-primary hover:border-gold hover:text-gold">
              Detail
            </Link>
            <Link href={`/portal/studio?opportunity=${encodeURIComponent(o.doc._id)}`} className="border border-gold/60 bg-gold/10 px-2.5 py-1.5 text-center text-[10px] uppercase tracking-[0.1em] text-primary hover:bg-gold/20">
              Model
            </Link>
          </div>
        )),
        ...selectedScens.map((s) => (
          <div key={`act-${s.id}`} className="flex flex-col gap-1.5">
            <Link href={`/portal/studio?scenario=${encodeURIComponent(s.id)}`} className="border border-border px-2.5 py-1.5 text-center text-[10px] uppercase tracking-[0.1em] text-primary hover:border-gold hover:text-gold">
              Open in Studio
            </Link>
          </div>
        )),
      ],
    })
  }

  return (
    <div className="space-y-8">
      {/* Selectors */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-card border border-border bg-card shadow-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base text-primary">Opportunities</h3>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{oppIds.length}/{MAX_COLS} selected</span>
          </div>
          <select className={selectCls} value="" onChange={(e) => e.target.value && toggleOpp(e.target.value)} aria-label="Add opportunity to comparison">
            <option value="">+ Add an opportunity…</option>
            {opportunities
              .filter((o) => !oppIds.includes(o.doc._id))
              .map((o) => (
                <option key={o.doc._id} value={o.doc._id}>{o.doc.title}</option>
              ))}
          </select>
          {oppIds.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedOpps.map((o) => (
                <button key={o.doc._id} type="button" onClick={() => toggleOpp(o.doc._id)} className="inline-flex items-center gap-1.5 border border-gold/50 bg-gold/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-primary">
                  {o.doc.title.slice(0, 32)} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 rounded-card border border-border bg-card shadow-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base text-primary">Saved scenarios</h3>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{scenIds.length}/{MAX_COLS} selected</span>
          </div>
          <select className={selectCls} value="" onChange={(e) => e.target.value && toggleScen(e.target.value)} aria-label="Add scenario to comparison">
            <option value="">+ Add a scenario…</option>
            {scenarios
              .filter((s) => !scenIds.includes(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </select>
          {scenIds.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedScens.map((s) => (
                <button key={s.id} type="button" onClick={() => toggleScen(s.id)} className="inline-flex items-center gap-1.5 border border-gold/50 bg-gold/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-primary">
                  {s.name.slice(0, 32)} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {notice ? <div className="border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs text-primary">{notice}</div> : null}

      {/* Comparison matrix */}
      {columns === 0 ? (
        <EmptyState
          icon={Columns3}
          title="Select what to compare"
          body="Pick up to four opportunities, saved Studio scenarios, or a mix. The matrix lines up pricing, yields, leverage assumptions, returns and risks side by side — exactly as an investment committee expects."
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-44 px-4 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Metric</th>
                {selectedOpps.map((o) => (
                  <th key={o.doc._id} className="px-4 py-3 font-display text-base font-medium text-primary">
                    {o.doc.title.slice(0, 40)}
                  </th>
                ))}
                {selectedScens.map((s) => (
                  <th key={s.id} className="px-4 py-3 font-display text-base font-medium text-primary">
                    {s.name.slice(0, 40)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{row.label}</td>
                  {row.cells.map((cell, j) => (
                    <td key={j} className={cn('px-4 py-3', i === rows.length - 1 && 'pt-4')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Save row */}
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-card shadow-card p-4">
        <label className="block flex-1 min-w-56">
          <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Name this comparison</span>
          <input
            className="w-full rounded-standard border border-border bg-background px-3 py-2.5 text-sm focus:border-primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q4 Nairobi office shortlist"
            maxLength={140}
          />
        </label>
        <button type="button" onClick={saveComparison} disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
          <Save className="h-3.5 w-3.5" /> Save comparison
        </button>
      </div>

      {/* Saved comparisons */}
      <section>
        <h3 className="mb-4 font-display text-xl text-primary">Saved comparisons</h3>
        {saved.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">No saved comparisons yet — save one to preserve a shortlist for committee review or later reflection.</p>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border bg-card shadow-card">
            {saved.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-primary">{c.name}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {c.sanityIds?.length || 0} opportunities · {c.scenarioIds?.length || 0} scenarios · saved {relativeTime(c.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOppIds(c.sanityIds || [])
                      setScenIds(c.scenarioIds || [])
                      setNotice('Comparison loaded into the workspace above.')
                      window.scrollTo({top: 0, behavior: 'smooth'})
                    }}
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-primary hover:border-gold hover:text-gold"
                  >
                    <Plus className="h-3 w-3" /> Load
                  </button>
                  <button type="button" onClick={() => removeComparison(c.id)} className="inline-flex items-center border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive" aria-label="Delete comparison">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
