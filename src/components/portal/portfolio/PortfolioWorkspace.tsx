'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Briefcase, Loader2, Plus, Trash2, Calculator} from 'lucide-react'
import Link from 'next/link'
import {fmtMoney, fmtPct, fmtDate, fmtRatio, humanizeStatus} from '@/lib/format'
import {StatusBadge, Metric, EmptyState} from '@/components/brand/primitives'
import {CURRENCY_OPTIONS, ASSET_CLASS_OPTIONS} from '@/lib/constants'
import {cn} from '@/lib/utils'

const input = 'w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground'

export interface CapitalCallRow {
  id: string
  label: string
  amount: number
  currency: string
  dueDate: string | null
  status: string
}

export interface PositionRow {
  id: string
  name: string
  sanityOpportunityId: string | null
  assetClass: string | null
  geography: string | null
  status: string
  acquisitionDate: string | null
  purchasePrice: number | null
  currency: string
  equityDeployed: number | null
  debtAmount: number | null
  debtRate: number | null
  debtMaturity: string | null
  grossIncomeAnnual: number | null
  operatingExpenses: number | null
  noiActual: number | null
  occupancyPct: number | null
  valuation: number | null
  valuationDate: string | null
  valuationBasis: string | null
  notes: string | null
  capitalCalls: CapitalCallRow[]
}

export default function PortfolioWorkspace({positions}: {positions: PositionRow[]}) {
  const router = useRouter()
  const [creating, setCreating] = useState(positions.length === 0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [callBusy, setCallBusy] = useState<string | null>(null)

  // Create form state
  const [form, setForm] = useState({
    name: '',
    assetClass: 'office',
    geography: '',
    status: 'held',
    acquisitionDate: '',
    purchasePrice: '',
    currency: 'USD',
    equityDeployed: '',
    debtAmount: '',
    debtRate: '',
    grossIncomeAnnual: '',
    operatingExpenses: '',
    noiActual: '',
    occupancyPct: '',
    valuation: '',
    valuationBasis: 'appraisal',
    notes: '',
  })

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2) {
      setError('Name the position.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/positions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: form.name.trim(),
          assetClass: form.assetClass,
          geography: form.geography.trim() || null,
          status: form.status,
          acquisitionDate: form.acquisitionDate ? new Date(form.acquisitionDate).toISOString() : null,
          purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
          currency: form.currency,
          equityDeployed: form.equityDeployed ? Number(form.equityDeployed) : null,
          debtAmount: form.debtAmount ? Number(form.debtAmount) : null,
          debtRate: form.debtRate ? Number(form.debtRate) : null,
          grossIncomeAnnual: form.grossIncomeAnnual ? Number(form.grossIncomeAnnual) : null,
          operatingExpenses: form.operatingExpenses ? Number(form.operatingExpenses) : null,
          noiActual: form.noiActual ? Number(form.noiActual) : null,
          occupancyPct: form.occupancyPct ? Number(form.occupancyPct) : null,
          valuation: form.valuation ? Number(form.valuation) : null,
          valuationBasis: form.valuationBasis,
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not record the position.')
        return
      }
      setCreating(false)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this position record?')) return
    const res = await fetch(`/api/positions/${id}`, {method: 'DELETE'}).catch(() => null)
    if (res && res.ok) router.refresh()
  }

  async function advanceCall(call: CapitalCallRow, status: string) {
    setCallBusy(call.id)
    await fetch(`/api/capital-calls/${call.id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({status}),
    }).catch(() => {})
    setCallBusy(null)
    router.refresh()
  }

  async function addCall(positionId: string) {
    const label = window.prompt('Capital call label (e.g. Second tranche — completion)')
    if (!label) return
    const amount = window.prompt('Amount (numbers only)')
    if (!amount || Number.isNaN(Number(amount))) return
    await fetch('/api/capital-calls', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({positionId, label, amount: Number(amount), currency: 'USD'}),
    }).catch(() => {})
    router.refresh()
  }

  // Aggregate actuals across held positions
  const held = positions.filter((p) => p.status !== 'exited')
  const totalEquity = held.reduce((s, p) => s + (p.equityDeployed ?? 0), 0)
  const totalNoi = held.reduce((s, p) => s + (p.noiActual ?? (p.grossIncomeAnnual ?? 0) - (p.operatingExpenses ?? 0)), 0)
  const totalValuation = held.reduce((s, p) => s + (p.valuation ?? 0), 0)
  const portfolioYield = totalValuation > 0 ? (totalNoi / totalValuation) * 100 : null
  const openCalls = positions.flatMap((p) => p.capitalCalls).filter((c) => c.status === 'scheduled' || c.status === 'called')

  return (
    <div className="space-y-8">
      {/* Snapshot */}
      {positions.length > 0 ? (
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Positions held" value={String(held.length)} sub={`${positions.length - held.length} exited`} />
          <Metric label="Equity deployed (actual)" value={fmtMoney(totalEquity || null, 'USD', {compact: true})} sub="as recorded" tone="gold" />
          <Metric label="Portfolio NOI (annual)" value={fmtMoney(totalNoi || null, 'USD', {compact: true})} sub={portfolioYield != null ? `${fmtPct(portfolioYield)} of valuation` : 'valuation not stated'} />
          <Metric label="Open capital calls" value={String(openCalls.length)} sub={openCalls.length ? 'attention required' : 'none outstanding'} tone={openCalls.length ? 'deep' : 'default'} />
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{positions.length} position{positions.length === 1 ? '' : 's'} · actual performance, distinct from pipeline analysis</span>
        <button type="button" onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:bg-forest-deep">
          <Plus className="h-4 w-4" /> Record a position
        </button>
      </div>

      {/* ============ CREATE ============ */}
      {creating ? (
        <form onSubmit={create} className="border border-gold/40 bg-card p-6 lg:p-8">
          <h3 className="mb-5 font-display text-xl text-primary">Record an owned or committed position</h3>
          {error ? <div className="mb-4 border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}
          <p className="mb-5 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Actuals only. Figures you record here are actual deployed capital, income and expenses — never projections (those live in the Investment Studio, labelled illustrative).
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="block lg:col-span-2">
              <span className={label}>Asset name</span>
              <input className={input} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="e.g. Delta Office Tower, Westlands" maxLength={160} />
            </label>
            <label className="block">
              <span className={label}>Status</span>
              <select className={input} value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}>
                <option value="committed">Committed</option>
                <option value="held">Held</option>
                <option value="exited">Exited</option>
              </select>
            </label>
            <label className="block">
              <span className={label}>Asset class</span>
              <select className={input} value={form.assetClass} onChange={(e) => setForm({...form, assetClass: e.target.value})}>
                {ASSET_CLASS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Geography</span>
              <input className={input} value={form.geography} onChange={(e) => setForm({...form, geography: e.target.value})} placeholder="Nairobi, Kenya" maxLength={120} />
            </label>
            <label className="block">
              <span className={label}>Acquisition date</span>
              <input type="date" className={input} value={form.acquisitionDate} onChange={(e) => setForm({...form, acquisitionDate: e.target.value})} />
            </label>
            <label className="block">
              <span className={label}>Currency</span>
              <select className={input} value={form.currency} onChange={(e) => setForm({...form, currency: e.target.value})}>
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.value}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Purchase price</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.purchasePrice} onChange={(e) => setForm({...form, purchasePrice: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>Equity deployed</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.equityDeployed} onChange={(e) => setForm({...form, equityDeployed: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>Debt amount</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.debtAmount} onChange={(e) => setForm({...form, debtAmount: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>Debt rate %</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.debtRate} onChange={(e) => setForm({...form, debtRate: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>Gross income (annual, actual)</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.grossIncomeAnnual} onChange={(e) => setForm({...form, grossIncomeAnnual: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>Operating expenses (annual)</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.operatingExpenses} onChange={(e) => setForm({...form, operatingExpenses: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>NOI (annual, actual)</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.noiActual} onChange={(e) => setForm({...form, noiActual: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>Occupancy %</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.occupancyPct} onChange={(e) => setForm({...form, occupancyPct: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>Latest valuation</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.valuation} onChange={(e) => setForm({...form, valuation: e.target.value.replace(/[^\d.]/g, '')})} />
            </label>
            <label className="block">
              <span className={label}>Valuation basis</span>
              <select className={input} value={form.valuationBasis} onChange={(e) => setForm({...form, valuationBasis: e.target.value})}>
                <option value="independent_valuation">Independent valuation</option>
                <option value="appraisal">Appraisal</option>
                <option value="manager_estimate">Manager estimate</option>
              </select>
            </label>
            <label className="block lg:col-span-3">
              <span className={label}>Notes</span>
              <textarea className={`${input} min-h-16`} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} maxLength={4000} placeholder="Reporting cadence, asset manager, covenants…" />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
            <button type="button" onClick={() => setCreating(false)} className="border border-border px-5 py-3 text-xs uppercase tracking-[0.14em] text-primary hover:border-gold hover:text-gold">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Record position
            </button>
          </div>
        </form>
      ) : null}

      {/* ============ LIST ============ */}
      {positions.length === 0 && !creating ? (
        <EmptyState
          icon={Briefcase}
          title="No positions recorded"
          body="When you transact through Murivest, your owned and committed assets are tracked here — deployed capital, financing, income actuals and valuations — with capital-call scheduling and exit planning linked back to the Investment Studio."
        />
      ) : (
        <div className="space-y-4">
          {positions.map((p) => {
            const open = expanded === p.id
            const noi = p.noiActual ?? (p.grossIncomeAnnual ?? 0) - (p.operatingExpenses ?? 0)
            const yieldOnCost = p.purchasePrice && noi ? (noi / p.purchasePrice) * 100 : null
            const equityMultiple = p.equityDeployed && p.valuation ? p.valuation / p.equityDeployed : null
            return (
              <article key={p.id} className="border border-border bg-card">
                <button type="button" onClick={() => setExpanded(open ? null : p.id)} className="flex w-full flex-col gap-3 p-6 text-left lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center gap-2">
                      <StatusBadge status={p.status} />
                      {p.assetClass ? <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{humanizeStatus(p.assetClass)}</span> : null}
                    </div>
                    <h3 className="font-display text-xl text-primary">{p.name}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {p.geography ? <span>{p.geography}</span> : null}
                      {p.acquisitionDate ? <span>acquired {fmtDate(p.acquisitionDate)}</span> : null}
                      {p.purchasePrice != null ? <span className="tabular">price {fmtMoney(p.purchasePrice, p.currency, {compact: true})}</span> : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center lg:text-right">
                    <div>
                      <div className="eyebrow mb-0.5">Equity</div>
                      <div className="tabular text-sm font-medium text-primary">{fmtMoney(p.equityDeployed, p.currency, {compact: true})}</div>
                    </div>
                    <div>
                      <div className="eyebrow mb-0.5">NOI</div>
                      <div className="tabular text-sm font-medium text-primary">{fmtMoney(noi || null, p.currency, {compact: true})}</div>
                    </div>
                    <div>
                      <div className="eyebrow mb-0.5">Yield on cost</div>
                      <div className="tabular text-sm font-medium text-primary">{fmtPct(yieldOnCost)}</div>
                    </div>
                  </div>
                </button>

                {open ? (
                  <div className="border-t border-border p-6">
                    <div className="grid gap-6 lg:grid-cols-3">
                      <div className="lg:col-span-2">
                        <div className="eyebrow mb-3">Asset-level detail</div>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Debt</dt>
                            <dd className="tabular text-primary">{fmtMoney(p.debtAmount, p.currency, {compact: true})}{p.debtRate != null ? ` @ ${p.debtRate}%` : ''}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Occupancy</dt>
                            <dd className="tabular text-primary">{fmtPct(p.occupancyPct, 1)}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Gross income</dt>
                            <dd className="tabular text-primary">{fmtMoney(p.grossIncomeAnnual, p.currency, {compact: true})}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Opex</dt>
                            <dd className="tabular text-primary">{fmtMoney(p.operatingExpenses, p.currency, {compact: true})}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Valuation</dt>
                            <dd className="tabular text-primary">
                              {fmtMoney(p.valuation, p.currency, {compact: true})}
                              {p.valuation ? <span className="ml-1 text-[10px] text-muted-foreground">{p.valuationDate ? fmtDate(p.valuationDate) : ''}</span> : null}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Value / equity</dt>
                            <dd className="tabular text-primary">{fmtRatio(equityMultiple)}</dd>
                          </div>
                        </dl>
                        {p.notes ? <p className="mt-4 border-l-2 border-gold/50 pl-3 text-xs leading-relaxed text-muted-foreground">{p.notes}</p> : null}
                        {p.valuationBasis ? (
                          <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            Valuation basis: {humanizeStatus(p.valuationBasis)} — actuals as recorded, distinct from illustrative projections
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="eyebrow">Capital calls</div>
                          <button type="button" onClick={() => addCall(p.id)} className="text-[10px] uppercase tracking-[0.12em] text-gold hover:underline">
                            + Add
                          </button>
                        </div>
                        {p.capitalCalls.length === 0 ? (
                          <p className="text-xs leading-relaxed text-muted-foreground">No calls recorded. Commitment-style tracking for institutional structures is scheduled here.</p>
                        ) : (
                          <ul className="space-y-2.5">
                            {p.capitalCalls.map((c) => (
                              <li key={c.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2">
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-medium text-primary">{c.label}</div>
                                  <div className="tabular text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                    {fmtMoney(c.amount, c.currency, {compact: true})} {c.dueDate ? `· due ${fmtDate(c.dueDate)}` : ''}
                                  </div>
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-1.5">
                                  {c.status === 'scheduled' ? (
                                    <button type="button" disabled={callBusy === c.id} onClick={() => advanceCall(c, 'called')} className="border border-border px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-primary hover:border-gold hover:text-gold">
                                      Called
                                    </button>
                                  ) : null}
                                  {c.status === 'called' ? (
                                    <button type="button" disabled={callBusy === c.id} onClick={() => advanceCall(c, 'paid')} className="border border-gold bg-gold/10 px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-primary hover:bg-gold/20">
                                      Paid
                                    </button>
                                  ) : null}
                                  <StatusBadge status={c.status} />
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-5 border-t border-border pt-4">
                          <Link href={`/portal/studio?opportunity=${encodeURIComponent(p.sanityOpportunityId || '')}`} className="inline-flex items-center gap-2 border border-gold/60 bg-gold/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:bg-gold/20">
                            <Calculator className="h-3.5 w-3.5" /> Plan the exit in Studio
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end border-t border-border pt-4">
                      <button type="button" onClick={() => remove(p.id)} className="inline-flex items-center gap-1.5 border border-border px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Remove record
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
