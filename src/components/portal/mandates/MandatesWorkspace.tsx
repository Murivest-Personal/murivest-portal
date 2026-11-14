'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Loader2, Plus, ScrollText, Trash2, ArrowRight} from 'lucide-react'
import {fmtMoney, fmtDate, humanizeStatus} from '@/lib/format'
import {StatusBadge, EmptyState} from '@/components/brand/primitives'
import {CURRENCY_OPTIONS, ASSET_CLASS_OPTIONS, GEO_OPTIONS} from '@/lib/constants'
import {cn} from '@/lib/utils'

const input = 'w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground'

export interface MandateRow {
  id: string
  reference: string
  title: string
  status: string
  description: string | null
  targetAllocationMin: number | null
  targetAllocationMax: number | null
  currency: string
  geographies: {country?: string; city?: string}[] | null
  assetClasses: string[] | null
  structures: string[] | null
  minNetYield: number | null
  targetIrr: number | null
  holdPeriodMin: number | null
  holdPeriodMax: number | null
  leverageComfort: number | null
  riskMandate: string | null
  exclusions: string[] | null
  submittedAt: string | null
  activatedAt: string | null
  closedAt: string | null
  createdAt: string
  milestones: {id: string; title: string; detail: string | null; dueDate: string | null; status: string; completedAt: string | null}[]
}

export default function MandatesWorkspace({mandates}: {mandates: MandateRow[]}) {
  const router = useRouter()
  const [creating, setCreating] = useState(mandates.length === 0)
  const [expanded, setExpanded] = useState<string | null>(mandates.find((m) => m.status === 'active')?.id || mandates[0]?.id || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Create form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [allocMin, setAllocMin] = useState('')
  const [allocMax, setAllocMax] = useState('')
  const [minNetYield, setMinNetYield] = useState('')
  const [targetIrr, setTargetIrr] = useState('')
  const [holdMin, setHoldMin] = useState('')
  const [holdMax, setHoldMax] = useState('')
  const [leverage, setLeverage] = useState('')
  const [risk, setRisk] = useState('')
  const [assetClasses, setAssetClasses] = useState<string[]>([])
  const [geoCountry, setGeoCountry] = useState('')
  const [submit, setSubmit] = useState(true)

  function toggleClass(v: string) {
    setAssetClasses((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (title.trim().length < 3) {
      setError('Give the mandate a title.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/mandates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          currency,
          targetAllocationMin: allocMin ? Number(allocMin) : null,
          targetAllocationMax: allocMax ? Number(allocMax) : null,
          minNetYield: minNetYield ? Number(minNetYield) : null,
          targetIrr: targetIrr ? Number(targetIrr) : null,
          holdPeriodMin: holdMin ? Number(holdMin) : null,
          holdPeriodMax: holdMax ? Number(holdMax) : null,
          leverageComfort: leverage ? Number(leverage) : null,
          riskMandate: risk || null,
          assetClasses: assetClasses.length ? assetClasses : null,
          geographies: geoCountry ? [{country: geoCountry}] : null,
          submit,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not create the mandate.')
        return
      }
      setCreating(false)
      setTitle('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function transition(m: MandateRow, status: string) {
    const res = await fetch(`/api/mandates/${m.id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({status}),
    }).catch(() => null)
    if (res && res.ok) router.refresh()
  }

  async function removeDraft(m: MandateRow) {
    if (!window.confirm(`Delete draft mandate ${m.reference}?`)) return
    const res = await fetch(`/api/mandates/${m.id}`, {method: 'DELETE'}).catch(() => null)
    if (res && res.ok) router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{mandates.length} mandate{mandates.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:bg-forest-deep">
          <Plus className="h-4 w-4" /> New mandate
        </button>
      </div>

      {/* ============ CREATE ============ */}
      {creating ? (
        <form onSubmit={create} className="border border-gold/40 bg-card p-6 lg:p-8">
          <h3 className="mb-5 font-display text-xl text-primary">Define an acquisition mandate</h3>
          {error ? <div className="mb-4 border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block lg:col-span-2">
              <span className={label}>Mandate title</span>
              <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nairobi Grade A office income mandate" maxLength={140} />
            </label>
            <label className="block lg:col-span-2">
              <span className={label}>Description &amp; intent</span>
              <textarea className={`${input} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="Objectives, structure preferences, exclusions, decision process…" />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className={label}>Currency</span>
                <select className={input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.value}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Allocation from</span>
                <input inputMode="decimal" className={`${input} tabular`} value={allocMin} onChange={(e) => setAllocMin(e.target.value.replace(/[^\d.]/g, ''))} placeholder="— min" />
              </label>
              <label className="block">
                <span className={label}>to</span>
                <input inputMode="decimal" className={`${input} tabular`} value={allocMax} onChange={(e) => setAllocMax(e.target.value.replace(/[^\d.]/g, ''))} placeholder="— max" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={label}>Min net yield %</span>
                <input inputMode="decimal" className={`${input} tabular`} value={minNetYield} onChange={(e) => setMinNetYield(e.target.value.replace(/[^\d.]/g, ''))} placeholder="—" />
              </label>
              <label className="block">
                <span className={label}>Target IRR %</span>
                <input inputMode="decimal" className={`${input} tabular`} value={targetIrr} onChange={(e) => setTargetIrr(e.target.value.replace(/[^\d.]/g, ''))} placeholder="—" />
              </label>
              <label className="block">
                <span className={label}>Hold from (yrs)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={holdMin} onChange={(e) => setHoldMin(e.target.value.replace(/[^\d.]/g, ''))} placeholder="—" />
              </label>
              <label className="block">
                <span className={label}>Hold to (yrs)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={holdMax} onChange={(e) => setHoldMax(e.target.value.replace(/[^\d.]/g, ''))} placeholder="—" />
              </label>
              <label className="block">
                <span className={label}>Leverage comfort (max LTV %)</span>
                <input inputMode="decimal" className={`${input} tabular`} value={leverage} onChange={(e) => setLeverage(e.target.value.replace(/[^\d.]/g, ''))} placeholder="—" />
              </label>
              <label className="block">
                <span className={label}>Risk disposition</span>
                <select className={input} value={risk} onChange={(e) => setRisk(e.target.value)}>
                  <option value="">Not stated</option>
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="opportunistic">Opportunistic</option>
                </select>
              </label>
            </div>
            <div>
              <span className={label}>Asset classes</span>
              <div className="flex flex-wrap gap-1.5">
                {ASSET_CLASS_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleClass(o.value)}
                    aria-pressed={assetClasses.includes(o.value)}
                    className={cn('border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors', assetClasses.includes(o.value) ? 'border-gold bg-gold/15 text-primary' : 'border-border text-muted-foreground hover:border-gold/50')}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={label}>Primary geography</span>
              <select className={input} value={geoCountry} onChange={(e) => setGeoCountry(e.target.value)}>
                <option value="">Any market</option>
                {GEO_OPTIONS.map((g) => (
                  <option key={g.value} value={g.label}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-5">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={submit} onChange={(e) => setSubmit(e.target.checked)} className="accent-[#1B4332]" />
              Submit to Murivest immediately (unchecked: save as draft)
            </label>
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={() => setCreating(false)} className="border border-border px-5 py-3 text-xs uppercase tracking-[0.14em] text-primary hover:border-gold hover:text-gold">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submit ? 'Submit mandate' : 'Save draft'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* ============ LIST ============ */}
      {mandates.length === 0 && !creating ? (
        <EmptyState
          icon={ScrollText}
          title="No mandates yet"
          body="An acquisition mandate formalises what Murivest sources for you — size, markets, structures, return targets. Define one and opportunities matching it are tagged in Discover, with milestone tracking against delivery."
          action={
            <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep">
              Define your first mandate
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {mandates.map((m) => {
            const open = expanded === m.id
            return (
              <article key={m.id} className="border border-border bg-card">
                <button type="button" onClick={() => setExpanded(open ? null : m.id)} className="flex w-full flex-col gap-3 p-6 text-left lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{m.reference}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <h3 className="font-display text-xl text-primary">{m.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {m.targetAllocationMin != null || m.targetAllocationMax != null ? (
                        <span className="tabular">
                          {m.currency} {m.targetAllocationMin ? fmtMoney(m.targetAllocationMin, m.currency, {compact: true}) : '—'} – {m.targetAllocationMax ? fmtMoney(m.targetAllocationMax, m.currency, {compact: true}) : '+'}
                        </span>
                      ) : null}
                      {m.minNetYield != null ? <span className="tabular">min net {m.minNetYield}%</span> : null}
                      {m.targetIrr != null ? <span className="tabular">IRR {m.targetIrr}%</span> : null}
                      {m.geographies?.length ? <span>{m.geographies.map((g) => g.country).join(', ')}</span> : null}
                      {m.assetClasses?.length ? <span>{m.assetClasses.length} asset classes</span> : null}
                    </div>
                  </div>
                  <ArrowRight className={cn('hidden h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform lg:block', open && 'rotate-90')} />
                </button>

                {open ? (
                  <div className="border-t border-border p-6">
                    {m.description ? <p className="mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{m.description}</p> : null}
                    <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <div className="eyebrow mb-1">Submitted</div>
                        <div className="text-primary">{m.submittedAt ? fmtDate(m.submittedAt) : 'Not yet'}</div>
                      </div>
                      <div>
                        <div className="eyebrow mb-1">Activated</div>
                        <div className="text-primary">{m.activatedAt ? fmtDate(m.activatedAt) : '—'}</div>
                      </div>
                      <div>
                        <div className="eyebrow mb-1">Hold period</div>
                        <div className="tabular text-primary">{m.holdPeriodMin != null || m.holdPeriodMax != null ? `${m.holdPeriodMin ?? '–'}–${m.holdPeriodMax ?? '+'} yrs` : '—'}</div>
                      </div>
                      <div>
                        <div className="eyebrow mb-1">Leverage</div>
                        <div className="tabular text-primary">{m.leverageComfort != null ? `${m.leverageComfort}% max LTV` : '—'}</div>
                      </div>
                    </div>

                    {/* Milestones */}
                    {m.milestones.length > 0 ? (
                      <div className="mt-6 border-t border-border pt-5">
                        <div className="eyebrow mb-3">Milestones</div>
                        <ol className="space-y-3">
                          {m.milestones.map((ms) => (
                            <li key={ms.id} className="flex items-start gap-3 text-sm">
                              <span className={cn('mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center border text-[9px]', ms.status === 'done' ? 'border-gold bg-gold/20 text-primary' : 'border-border text-transparent')}>
                                {ms.status === 'done' ? '✓' : ''}
                              </span>
                              <div className="min-w-0">
                                <div className={cn('font-medium', ms.status === 'done' ? 'text-muted-foreground line-through' : 'text-primary')}>{ms.title}</div>
                                {ms.detail ? <div className="mt-0.5 text-xs text-muted-foreground">{ms.detail}</div> : null}
                                <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                  {humanizeStatus(ms.status)}{ms.dueDate ? ` · due ${fmtDate(ms.dueDate)}` : ''}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : (
                      <p className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
                        Your advisor adds transaction milestones here — sourcing, LOI, exclusivity, due diligence, completion.
                      </p>
                    )}

                    {/* Lifecycle controls */}
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                      {m.status === 'draft' ? (
                        <>
                          <button type="button" onClick={() => transition(m, 'submitted')} className="border border-primary bg-primary px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep">
                            Submit for review
                          </button>
                          <button type="button" onClick={() => removeDraft(m)} className="inline-flex items-center gap-1.5 border border-border px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:border-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" /> Delete draft
                          </button>
                        </>
                      ) : null}
                      {m.status === 'active' ? (
                        <button type="button" onClick={() => transition(m, 'paused')} className="border border-border px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                          Pause mandate
                        </button>
                      ) : null}
                      {m.status === 'paused' ? (
                        <button type="button" onClick={() => transition(m, 'submitted')} className="border border-primary bg-primary px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep">
                          Resume
                        </button>
                      ) : null}
                      {['active', 'paused', 'submitted'].includes(m.status) ? (
                        <button type="button" onClick={() => transition(m, 'closed')} className="border border-border px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:border-destructive hover:text-destructive">
                          Close mandate
                        </button>
                      ) : null}
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
