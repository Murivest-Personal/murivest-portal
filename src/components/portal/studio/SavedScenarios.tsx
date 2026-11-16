'use client'

import {useEffect, useState} from 'react'
import {Trash2, FileDown, Calculator, ArrowUpRight} from 'lucide-react'
import Link from 'next/link'
import {fmtMoney, fmtPct, fmtRatio, relativeTime} from '@/lib/format'
import type {ScenarioInputs} from '@/lib/validation'
import {EmptyState} from '@/components/brand/primitives'

export interface SavedScenarioRow {
  id: string
  name: string
  opportunityTitle: string | null
  sanityOpportunityId: string | null
  inputs: ScenarioInputs
  summary: {
    totalCapitalRequirement?: number
    equityRequired?: number
    irrPct?: number | null
    cashOnCashPct?: number | null
    dscr?: number | null
    equityMultiple?: number | null
    capitalGap?: number
    executableNow?: boolean
  } | null
  notes: string | null
  updatedAt: string
}

/** Saved analyses — continuity: reopen any scenario with its full assumption set. */
export default function SavedScenarios({initial}: {initial: SavedScenarioRow[]}) {
  const [rows, setRows] = useState(initial)

  useEffect(() => {
    // Always re-sync on mount (server props may predate in-session saves)
    let cancelled = false
    fetch('/api/scenarios', {cache: 'no-store'})
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.scenarios) setRows(d.scenarios)
      })
      .catch(() => {})
    const handler = () => {
      fetch('/api/scenarios', {cache: 'no-store'})
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.scenarios) setRows(d.scenarios)
        })
        .catch(() => {})
    }
    window.addEventListener('studio:scenario-saved', handler)
    return () => {
      cancelled = true
      window.removeEventListener('studio:scenario-saved', handler)
    }
  }, [])

  async function remove(id: string) {
    if (!window.confirm('Delete this saved scenario? The action cannot be undone.')) return
    const res = await fetch(`/api/scenarios/${id}`, {method: 'DELETE'}).catch(() => null)
    if (res && res.ok) setRows((r) => r.filter((x) => x.id !== id))
  }

  function exportRow(row: SavedScenarioRow) {
    const blob = new Blob([JSON.stringify({scenario: row.name, assumptions: row.inputs, computedSummary: row.summary}, null, 2)], {type: 'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `murivest-scenario-${row.name.replace(/\W+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Calculator}
        title="No saved analyses yet"
        body="Build a scenario in the Model tab and save it — your assumptions, capital-gap view and sensitivities persist here so you can return weeks or months later and resume exactly where you left off."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
      <table className="w-full min-w-200 text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Scenario</th>
            <th className="px-4 py-3 font-medium">Capital req.</th>
            <th className="px-4 py-3 font-medium">Equity</th>
            <th className="px-4 py-3 font-medium">IRR</th>
            <th className="px-4 py-3 font-medium">CoC</th>
            <th className="px-4 py-3 font-medium">DSCR</th>
            <th className="px-4 py-3 font-medium">Gap</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const c = row.inputs.currency || 'USD'
            return (
              <tr key={row.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">{row.name}</div>
                  {row.opportunityTitle ? <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{row.opportunityTitle}</div> : null}
                </td>
                <td className="tabular px-4 py-3">{fmtMoney(row.summary?.totalCapitalRequirement ?? null, c, {compact: true})}</td>
                <td className="tabular px-4 py-3">{fmtMoney(row.summary?.equityRequired ?? null, c, {compact: true})}</td>
                <td className="tabular px-4 py-3 font-medium text-primary">{fmtPct(row.summary?.irrPct ?? null, 1)}</td>
                <td className="tabular px-4 py-3">{fmtPct(row.summary?.cashOnCashPct ?? null, 1)}</td>
                <td className="tabular px-4 py-3">{fmtRatio(row.summary?.dscr ?? null)}</td>
                <td className="tabular px-4 py-3">
                  {row.summary?.capitalGap ? (
                    <span className="border border-gold/50 bg-gold/10 px-1.5 py-0.5 text-[10px] text-primary">{fmtMoney(row.summary.capitalGap, c, {compact: true})}</span>
                  ) : row.summary ? (
                    <span className="text-emerald-700">covered</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(row.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Link
                      href={`/portal/studio?scenario=${encodeURIComponent(row.id)}`}
                      className="inline-flex items-center gap-1 border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-primary hover:border-gold hover:text-gold"
                      title="Open in the builder"
                    >
                      Open <ArrowUpRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href={`/portal/compare?scenario=${encodeURIComponent(row.id)}`}
                      className="inline-flex items-center gap-1 border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-primary hover:border-gold hover:text-gold"
                      title="Add to comparison"
                    >
                      Compare
                    </Link>
                    <button type="button" onClick={() => exportRow(row)} className="inline-flex items-center border border-border p-1.5 text-muted-foreground hover:border-gold hover:text-gold" title="Export JSON">
                      <FileDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(row.id)} className="inline-flex items-center border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
