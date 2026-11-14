'use client'

import {useMemo, useState} from 'react'
import {Calculator, Download, Loader2, Save, TriangleAlert} from 'lucide-react'
import type {ScenarioInputs} from '@/lib/validation'
import {computeScenario, capitalGapPathways, sensitivityGrid} from '@/lib/finance/engine'
import {fmtMoney, fmtNumber, fmtPct, fmtRatio, fmtYears} from '@/lib/format'
import {CURRENCY_OPTIONS} from '@/lib/constants'
import {cn} from '@/lib/utils'

const input = 'w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none'
const label = 'mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground'

export const NEUTRAL_INPUTS: ScenarioInputs = {
  price: 0,
  currency: 'USD',
  acquisitionCostsPct: 0,
  useDebt: true,
  ltvPct: 60,
  interestRatePct: 0,
  termYears: 20,
  amortizationYears: 20,
  ioYears: 0,
  grossIncome: 0,
  opex: 0,
  growthPct: 0,
  opexGrowthPct: 0,
  holdYears: 5,
  exitType: 'timed_sale',
  exitValueMode: 'cap_rate',
  exitCapRatePct: 0,
  exitValue: 0,
  exitGrowthPct: 0,
  sellingCostsPct: 0,
  equityAvailable: 0,
}

function num(v: string): number {
  const n = Number(v.replace(/[^\d.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export default function ScenarioBuilder({
  prefill,
  prefillSource,
  equityDefault,
}: {
  prefill?: Partial<ScenarioInputs>
  prefillSource?: {sanityId: string; title: string} | null
  equityDefault?: number | null
}) {
  const [inputs, setInputs] = useState<ScenarioInputs>({
    ...NEUTRAL_INPUTS,
    ...(equityDefault ? {equityAvailable: equityDefault} : {}),
    ...prefill,
  })
  const [name, setName] = useState(prefillSource ? `${prefillSource.title.slice(0, 60)} — base case` : '')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'gap' | 'sensitivity' | 'projection'>('gap')

  function set<K extends keyof ScenarioInputs>(key: K, value: ScenarioInputs[K]) {
    setInputs((f) => ({...f, [key]: value}))
    setSavedId(null)
  }

  const result = useMemo(() => computeScenario(inputs), [inputs])
  const pathways = useMemo(() => capitalGapPathways(inputs), [inputs])

  const sensitivity = useMemo(() => {
    const baseRate = inputs.interestRatePct || 8
    const baseCap = inputs.exitValueMode === 'cap_rate' && inputs.exitCapRatePct ? inputs.exitCapRatePct : 8
    const rows = [baseRate - 2, baseRate - 1, baseRate, baseRate + 1, baseRate + 2].map((v) => Math.round(v * 100) / 100)
    const cols = [baseCap - 1.5, baseCap - 0.75, baseCap, baseCap + 0.75, baseCap + 1.5].map((v) => Math.max(Math.round(v * 100) / 100, 0.5))
    return sensitivityGrid(inputs, 'irr', 'rate', 'exit_cap', rows, cols)
  }, [inputs])

  async function saveScenario() {
    if (!name.trim()) {
      setError('Name this scenario before saving.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        sanityOpportunityId: prefillSource?.sanityId ?? null,
        opportunityTitle: prefillSource?.title ?? null,
        inputs,
        notes: notes.trim() || null,
      }
      const res = await fetch(savedId ? `/api/scenarios/${savedId}` : '/api/scenarios', {
        method: savedId ? 'PATCH' : 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not save the scenario.')
        return
      }
      setSavedId(data.scenario?.id ?? null)
      window.dispatchEvent(new CustomEvent('studio:scenario-saved'))
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  function exportJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            scenario: name,
            opportunity: prefillSource ?? null,
            assumptions: inputs,
            computedSummary: result,
            disclaimer: 'All figures are illustrative outputs of investor-supplied assumptions. Not investment advice; not verified valuations.',
          },
          null,
          2,
        ),
      ],
      {type: 'application/json'},
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `murivest-scenario-${(name || 'untitled').replace(/\W+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {error ? <div className="border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}

      {/* Model header */}
      <div className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Scenario name</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Westlands office — 60% LTV base case" maxLength={120} />
          </label>
          <label className="block">
            <span className={label}>Currency of analysis</span>
            <select className={input} value={inputs.currency} onChange={(e) => set('currency', e.target.value as never)}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.value}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={saveScenario} disabled={busy} className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {savedId ? 'Update' : 'Save'}
          </button>
          <button type="button" onClick={exportJson} className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-primary hover:border-gold hover:text-gold">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button type="button" onClick={() => window.print()} className="hidden items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-primary hover:border-gold hover:text-gold sm:inline-flex">
            Print
          </button>
        </div>
      </div>

      {prefillSource ? (
        <div className="flex items-start gap-2 border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">
          <Calculator className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
          Starting assumptions imported from published figures for “{prefillSource.title}”. Adjust every input to your own underwriting — nothing here is auto-applied.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        {/* ================= INPUTS ================= */}
        <div className="min-w-0 space-y-6">
          {/* Acquisition */}
          <section className="border border-border bg-card p-5">
            <h3 className="mb-4 font-display text-lg text-primary">1 · Acquisition</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={label}>Purchase price</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.price || ''} onChange={(e) => set('price', num(e.target.value))} placeholder="0" />
              </label>
              <label className="block">
                <span className={label}>Acquisition costs %</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.acquisitionCostsPct || ''} onChange={(e) => set('acquisitionCostsPct', num(e.target.value))} placeholder="0" />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Equity available to you (for gap analysis)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.equityAvailable || ''} onChange={(e) => set('equityAvailable', num(e.target.value))} placeholder="0" />
              </label>
            </div>
          </section>

          {/* Financing */}
          <section className="border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg text-primary">2 · Financing structure</h3>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={inputs.useDebt} onChange={(e) => set('useDebt', e.target.checked)} className="accent-[#1B4332]" />
                Use debt
              </label>
            </div>
            <div className={cn('grid grid-cols-2 gap-4', !inputs.useDebt && 'pointer-events-none opacity-40')}>
              <label className="block">
                <span className={label}>LTV on price %</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.ltvPct || ''} onChange={(e) => set('ltvPct', num(e.target.value))} />
              </label>
              <label className="block">
                <span className={label}>Interest rate %</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.interestRatePct || ''} onChange={(e) => set('interestRatePct', num(e.target.value))} placeholder="e.g. 9.5" />
              </label>
              <label className="block">
                <span className={label}>Term (yrs)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.termYears || ''} onChange={(e) => set('termYears', num(e.target.value) || 1)} />
              </label>
              <label className="block">
                <span className={label}>Amortisation (yrs)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.amortizationYears || ''} onChange={(e) => set('amortizationYears', num(e.target.value) || 1)} />
              </label>
              <label className="block">
                <span className={label}>Interest-only period (yrs)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.ioYears || ''} onChange={(e) => set('ioYears', num(e.target.value))} />
              </label>
            </div>
          </section>

          {/* Income */}
          <section className="border border-border bg-card p-5">
            <h3 className="mb-4 font-display text-lg text-primary">3 · Income assumptions</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={label}>Gross income (yr 1)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.grossIncome || ''} onChange={(e) => set('grossIncome', num(e.target.value))} placeholder="0" />
              </label>
              <label className="block">
                <span className={label}>Operating expenses (yr 1)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.opex || ''} onChange={(e) => set('opex', num(e.target.value))} placeholder="0" />
              </label>
              <label className="block">
                <span className={label}>Income growth % / yr</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.growthPct || ''} onChange={(e) => set('growthPct', num(e.target.value))} placeholder="0" />
              </label>
              <label className="block">
                <span className={label}>Opex growth % / yr</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.opexGrowthPct || ''} onChange={(e) => set('opexGrowthPct', num(e.target.value))} placeholder="0" />
              </label>
            </div>
          </section>

          {/* Exit */}
          <section className="border border-border bg-card p-5">
            <h3 className="mb-4 font-display text-lg text-primary">4 · Hold &amp; exit strategy</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={label}>Hold period (yrs)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.holdYears || ''} onChange={(e) => set('holdYears', num(e.target.value) || 1)} />
              </label>
              <label className="block">
                <span className={label}>Exit strategy</span>
                <select className={input} value={inputs.exitType} onChange={(e) => set('exitType', e.target.value as never)}>
                  <option value="hold_for_income">Hold for income</option>
                  <option value="timed_sale">Timed sale</option>
                  <option value="value_add_exit">Value-add exit</option>
                  <option value="refinance">Refinance path</option>
                </select>
              </label>
              <label className="block">
                <span className={label}>Exit value method</span>
                <select className={input} value={inputs.exitValueMode} onChange={(e) => set('exitValueMode', e.target.value as never)}>
                  <option value="cap_rate">Exit cap rate</option>
                  <option value="exit_value">Explicit exit value</option>
                </select>
              </label>
              {inputs.exitValueMode === 'cap_rate' ? (
                <label className="block">
                  <span className={label}>Exit cap rate %</span>
                  <input inputMode="decimal" className={`${input} tabular`} value={inputs.exitCapRatePct || ''} onChange={(e) => set('exitCapRatePct', num(e.target.value))} placeholder="e.g. 8" />
                </label>
              ) : (
                <label className="block">
                  <span className={label}>Exit value</span>
                  <input inputMode="decimal" className={`${input} tabular`} value={inputs.exitValue || ''} onChange={(e) => set('exitValue', num(e.target.value))} placeholder="0" />
                </label>
              )}
              <label className="block">
                <span className={label}>Exit growth % (fallback)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.exitGrowthPct || ''} onChange={(e) => set('exitGrowthPct', num(e.target.value))} placeholder="0" />
              </label>
              <label className="block">
                <span className={label}>Selling costs %</span>
                <input inputMode="decimal" className={`${input} tabular`} value={inputs.sellingCostsPct || ''} onChange={(e) => set('sellingCostsPct', num(e.target.value))} placeholder="0" />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Notes to self</span>
                <textarea className={`${input} min-h-16`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Assumption provenance, TODO verification, advisor guidance…" />
              </label>
            </div>
          </section>
        </div>

        {/* ================= LIVE RESULTS ================= */}
        <div className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="border border-primary bg-primary p-5 text-primary-foreground">
            <div className="eyebrow mb-4 !text-gold/80">Live underwriting — illustrative</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">Total capital req.</div>
                <div className="tabular font-display text-xl text-gold">{fmtMoney(result.totalCapitalRequirement, inputs.currency)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">Equity required</div>
                <div className="tabular font-display text-xl text-ivory">{fmtMoney(result.equityRequired, inputs.currency)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">NOI (yr 1)</div>
                <div className="tabular font-display text-xl text-ivory">{fmtMoney(result.noi, inputs.currency)}</div>
                <div className="mt-0.5 text-[10px] text-primary-foreground/50">
                  gross {fmtPct(result.grossYieldPct)} · net {fmtPct(result.netYieldPct)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">{inputs.useDebt ? 'DSCR' : 'All-cash yield'}</div>
                <div className="tabular font-display text-xl text-ivory">
                  {inputs.useDebt ? fmtRatio(result.dscr) : fmtPct(result.cashOnCashPct)}
                </div>
                {inputs.useDebt ? <div className="mt-0.5 text-[10px] text-primary-foreground/50">CoC {fmtPct(result.cashOnCashPct)}</div> : null}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">Levered IRR</div>
                <div className="tabular font-display text-xl text-gold">{fmtPct(result.irrPct, 1)}</div>
                <div className="mt-0.5 text-[10px] text-primary-foreground/50">unlevered {fmtPct(result.unleveredIrrPct, 1)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-primary-foreground/60">Equity multiple</div>
                <div className="tabular font-display text-xl text-ivory">{fmtRatio(result.equityMultiple, 2)}</div>
                <div className="mt-0.5 text-[10px] text-primary-foreground/50">
                  payback {result.simplePaybackYears ? fmtYears(result.simplePaybackYears) : 'beyond horizon'}
                </div>
              </div>
            </div>
          </section>

          {/* Capital gap */}
          <section className={cn('border p-5', result.executableNow ? 'border-emerald-300 bg-emerald-50/60' : result.equityRequired > 0 && inputs.equityAvailable > 0 ? 'border-gold/50 bg-gold/5' : 'border-border bg-card')}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg text-primary">Capital gap</h3>
              {result.executableNow ? (
                <span className="border border-emerald-400 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">Executable now</span>
              ) : (
                <span className="border border-gold bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary">Structure required</span>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Equity available</dt>
                <dd className="tabular mt-0.5 font-medium text-primary">{fmtMoney(result.equityAvailable, inputs.currency)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Equity required</dt>
                <dd className="tabular mt-0.5 font-medium text-primary">{fmtMoney(result.equityRequired, inputs.currency)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Gap</dt>
                <dd className="tabular mt-0.5 font-medium text-primary">
                  {result.capitalGap > 0 ? fmtMoney(result.capitalGap, inputs.currency) : '—'}
                  {result.capitalGap > 0 ? <span className="ml-1 text-[10px] text-muted-foreground">{fmtPct(result.gapPctOfRequirement, 1)} of req.</span> : null}
                </dd>
              </div>
            </dl>
            {!result.executableNow && result.capitalGap > 0 ? (
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-primary">
                <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                Stated equity alone does not cover this structure. The pathway table below shows the LTV and returns at each financing point — opportunities are never dismissed for a capital gap alone.
              </p>
            ) : null}
          </section>

          {/* Views */}
          <section className="border border-border bg-card">
            <div className="grid grid-cols-3 border-b border-border text-center text-[10px] uppercase tracking-[0.14em]">
              {(
                [
                  ['gap', 'Pathways'],
                  ['sensitivity', 'Sensitivity'],
                  ['projection', 'Projection'],
                ] as const
              ).map(([key, lbl]) => (
                <button key={key} type="button" onClick={() => setView(key)} className={cn('px-2 py-3 transition-colors', view === key ? 'bg-gold/10 font-semibold text-primary' : 'text-muted-foreground hover:text-primary')}>
                  {lbl}
                </button>
              ))}
            </div>

            {view === 'gap' ? (
              <div className="overflow-x-auto p-1">
                <table className="w-full min-w-120 text-xs">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-3 py-2 font-medium">LTV</th>
                      <th className="px-3 py-2 font-medium">Debt</th>
                      <th className="px-3 py-2 font-medium">Equity req.</th>
                      <th className="px-3 py-2 font-medium">Residual gap</th>
                      <th className="px-3 py-2 font-medium">DSCR</th>
                      <th className="px-3 py-2 font-medium">IRR</th>
                      <th className="px-3 py-2 font-medium">Executable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pathways.map((p) => (
                      <tr key={p.label} className={cn('border-t border-border/60', p.executable && 'bg-emerald-50/50')}>
                        <td className="tabular px-3 py-2 font-medium text-primary">{p.label}</td>
                        <td className="tabular px-3 py-2">{fmtMoney(p.loanAmount, inputs.currency, {compact: true})}</td>
                        <td className="tabular px-3 py-2">{fmtMoney(p.equityRequired, inputs.currency, {compact: true})}</td>
                        <td className="tabular px-3 py-2">{p.residualGap > 0 ? fmtMoney(p.residualGap, inputs.currency, {compact: true}) : '—'}</td>
                        <td className="tabular px-3 py-2">{p.dscr ? fmtRatio(p.dscr) : 'n/a'}</td>
                        <td className="tabular px-3 py-2 font-medium text-primary">{fmtPct(p.irrPct, 1)}</td>
                        <td className="px-3 py-2">
                          {p.executable ? <span className="text-emerald-700">✓</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Illustrative structures at your rate &amp; exit assumptions — not lending offers
                </p>
              </div>
            ) : null}

            {view === 'sensitivity' ? (
              <div className="overflow-x-auto p-1">
                <table className="w-full min-w-120 text-xs">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-2 py-2 text-left font-medium">{sensitivity.rowLabel}</th>
                      {sensitivity.cols.map((c) => (
                        <th key={c} className="tabular px-2 py-2 text-center font-medium">{fmtNumber(c, 2)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.rows.map((r, i) => (
                      <tr key={r} className="border-t border-border/60">
                        <td className="tabular px-2 py-2 text-left font-medium text-primary">{fmtNumber(r, 2)}</td>
                        {sensitivity.cells[i].map((cell) => {
                          const v = cell.value
                          const best = sensitivity.cells.flat().filter((c) => c.value != null).reduce((mx, c) => Math.max(mx ?? -Infinity, c.value ?? -Infinity), -Infinity)
                          return (
                            <td key={`${r}-${cell.colValue}`} className={cn('tabular px-2 py-2 text-center', v == null ? 'text-muted-foreground/50' : 'font-medium text-primary', v != null && v === best && 'bg-gold/15 text-primary')}>
                              {v == null ? '—' : fmtPct(v, 1)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">Levered IRR % · rate × exit cap rate · gold cell = best in grid</p>
              </div>
            ) : null}

            {view === 'projection' ? (
              <div className="portal-scroll max-h-96 overflow-auto p-1">
                <table className="w-full min-w-150 text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Yr</th>
                      <th className="px-2 py-2 font-medium">Gross</th>
                      <th className="px-2 py-2 font-medium">Opex</th>
                      <th className="px-2 py-2 font-medium">NOI</th>
                      <th className="px-2 py-2 font-medium">Debt svc.</th>
                      <th className="px-2 py-2 font-medium">CF after debt</th>
                      <th className="px-2 py-2 font-medium">Loan bal.</th>
                      <th className="px-2 py-2 font-medium">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.years.map((y) => (
                      <tr key={y.year} className="border-t border-border/60">
                        <td className="tabular px-2 py-2 font-medium text-primary">{y.year}</td>
                        <td className="tabular px-2 py-2">{fmtMoney(y.grossIncome, inputs.currency, {compact: true})}</td>
                        <td className="tabular px-2 py-2">{fmtMoney(y.opex, inputs.currency, {compact: true})}</td>
                        <td className="tabular px-2 py-2 font-medium text-primary">{fmtMoney(y.noi, inputs.currency, {compact: true})}</td>
                        <td className="tabular px-2 py-2">{fmtMoney(y.debtService, inputs.currency, {compact: true})}</td>
                        <td className="tabular px-2 py-2">{fmtMoney(y.cashFlowAfterDebt, inputs.currency, {compact: true})}</td>
                        <td className="tabular px-2 py-2">{fmtMoney(y.loanBalanceEnd, inputs.currency, {compact: true})}</td>
                        <td className="tabular px-2 py-2 text-muted-foreground">{fmtMoney(y.cumulativeCashFlow, inputs.currency, {compact: true})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-2 py-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  Exit at year {fmtNumber(inputs.holdYears, 0)}: value {fmtMoney(result.exitValue, inputs.currency, {compact: true})} · net proceeds {fmtMoney(result.netExitProceeds, inputs.currency, {compact: true})}
                </p>
              </div>
            ) : null}
          </section>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Every figure above is an <strong className="text-primary">illustrative</strong> output of the assumptions you entered. Formulas: NOI = gross income − opex; equity = price + acquisition costs − debt; annual debt service annuitises after any interest-only period; exit value = exit NOI ÷ cap rate or your explicit value; IRR solves the levered cash-flow vector. Nothing is investment advice or a verified valuation.
          </p>
        </div>
      </div>
    </div>
  )
}
