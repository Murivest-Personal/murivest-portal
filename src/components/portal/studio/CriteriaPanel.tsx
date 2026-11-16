'use client'

import {useState} from 'react'
import {Loader2, Save} from 'lucide-react'
import type {CriteriaInput} from '@/lib/validation'
import {ASSET_CLASS_OPTIONS, DEAL_STRUCTURE_OPTIONS, CURRENCY_OPTIONS, GEO_OPTIONS} from '@/lib/constants'
import {cn} from '@/lib/utils'

const input = 'w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground'

const EXIT_OPTIONS = [
  {value: 'hold_for_income', label: 'Hold for income'},
  {value: 'timed_sale', label: 'Timed sale'},
  {value: 'value_add_exit', label: 'Value-add exit'},
  {value: 'refinance', label: 'Refinance path'},
]

const RISK_OPTIONS = [
  {value: 'conservative', label: 'Conservative'},
  {value: 'balanced', label: 'Balanced'},
  {value: 'opportunistic', label: 'Opportunistic'},
  {value: 'distressed', label: 'Distressed'},
]

export default function CriteriaPanel({initial}: {initial: CriteriaInput | null}) {
  const [form, setForm] = useState<CriteriaInput>(
    initial ?? {
      currency: 'USD',
      financingOpen: true,
      geographies: [],
      assetClasses: [],
      structures: [],
      exitPreferences: [],
    },
  )
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof CriteriaInput>(key: K, value: CriteriaInput[K]) {
    setForm((f) => ({...f, [key]: value}))
    setSaved(false)
  }

  function toggleInArray(key: 'assetClasses' | 'structures' | 'exitPreferences', value: string) {
    const list = (form[key] || []) as string[]
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    set(key, next as never)
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/criteria', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not save criteria.')
        return
      }
      setSaved(true)
      setTimeout(() => window.location.reload(), 600)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  const geoRows = (form.geographies || []) as {country: string; city?: string}[]

  return (
    <div className="space-y-6">
      {error ? <div className="border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}
      {saved ? <div className="border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs text-primary">Criteria saved — Discover, matching and mandate pre-fills now use them.</div> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Capital */}
        <section className="space-y-4 border border-border bg-card p-5">
          <h3 className="font-display text-lg text-primary">Capital &amp; currency</h3>
          <label className="block">
            <span className={label}>Reporting currency</span>
            <select className={input} value={form.currency} onChange={(e) => set('currency', e.target.value as never)}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          {(
            [
              ['equityAvailable', 'Equity available today'],
              ['totalCapacity', 'Total programme capacity'],
              ['minTicket', 'Minimum single ticket'],
              ['maxTicket', 'Maximum single ticket'],
            ] as const
          ).map(([key, lbl]) => (
            <label key={key} className="block">
              <span className={label}>{lbl}</span>
              <input
                inputMode="decimal"
                className={`${input} tabular`}
                value={(form[key] as number | null) ?? ''}
                onChange={(e) => set(key, (e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null) as never)}
                placeholder="—"
              />
            </label>
          ))}
        </section>

        {/* Where & what */}
        <section className="space-y-4 border border-border bg-card p-5">
          <h3 className="font-display text-lg text-primary">Where &amp; what</h3>
          <div>
            <span className={label}>Asset classes</span>
            <div className="flex flex-wrap gap-1.5">
              {ASSET_CLASS_OPTIONS.map((o) => {
                const active = (form.assetClasses || []).includes(o.value as never)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleInArray('assetClasses', o.value)}
                    aria-pressed={active}
                    className={cn('border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors', active ? 'border-gold bg-gold/15 text-primary' : 'border-border text-muted-foreground hover:border-gold/50')}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <span className={label}>Structures considered</span>
            <div className="flex flex-wrap gap-1.5">
              {DEAL_STRUCTURE_OPTIONS.map((o) => {
                const active = (form.structures || []).includes(o.value as never)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleInArray('structures', o.value)}
                    aria-pressed={active}
                    className={cn('border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors', active ? 'border-gold bg-gold/15 text-primary' : 'border-border text-muted-foreground hover:border-gold/50')}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={form.financingOpen ?? true} onChange={(e) => set('financingOpen', e.target.checked)} className="accent-[#1B4332]" />
              Open to financing / leverage
            </label>
          </div>
          <div>
            <span className={label}>Geographies</span>
            <div className="space-y-2">
              {geoRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    className={input}
                    value={row.country || ''}
                    onChange={(e) => {
                      const next = [...geoRows]
                      next[i] = {...row, country: e.target.value}
                      set('geographies', next)
                    }}
                  >
                    <option value="">Country…</option>
                    {GEO_OPTIONS.map((g) => (
                      <option key={g.value} value={g.label}>{g.label}</option>
                    ))}
                  </select>
                  <input
                    className={input}
                    value={row.city || ''}
                    placeholder="City / market"
                    onChange={(e) => {
                      const next = [...geoRows]
                      next[i] = {...row, city: e.target.value}
                      set('geographies', next)
                    }}
                  />
                  <button type="button" onClick={() => set('geographies', geoRows.filter((_, j) => j !== i))} className="border border-border px-2 text-xs text-muted-foreground hover:text-destructive">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => set('geographies', [...geoRows, {country: '', city: ''}])} className="border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                + Add geography
              </button>
            </div>
          </div>
        </section>

        {/* Returns, hold, leverage, risk */}
        <section className="space-y-4 border border-border bg-card p-5">
          <h3 className="font-display text-lg text-primary">Returns, hold &amp; risk</h3>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['minGrossYield', 'Min gross yield %'],
                ['minNetYield', 'Min net yield %'],
                ['targetIrr', 'Target IRR %'],
                ['targetCashOnCash', 'Target cash-on-cash %'],
                ['targetPaybackYears', 'Payback (yrs)'],
                ['leverageComfort', 'Max LTV %'],
              ] as const
            ).map(([key, lbl]) => (
              <label key={key} className="block">
                <span className={label}>{lbl}</span>
                <input
                  inputMode="decimal"
                  className={`${input} tabular`}
                  value={(form[key] as number | null) ?? ''}
                  onChange={(e) => set(key, (e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null) as never)}
                  placeholder="—"
                />
              </label>
            ))}
            <label className="block">
              <span className={label}>Hold from (yrs)</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.holdPeriodMin ?? ''} onChange={(e) => set('holdPeriodMin', e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null)} placeholder="—" />
            </label>
            <label className="block">
              <span className={label}>Hold to (yrs)</span>
              <input inputMode="decimal" className={`${input} tabular`} value={form.holdPeriodMax ?? ''} onChange={(e) => set('holdPeriodMax', e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null)} placeholder="—" />
            </label>
          </div>
          <div>
            <span className={label}>Risk tolerance</span>
            <select className={input} value={form.riskTolerance || ''} onChange={(e) => set('riskTolerance', (e.target.value || null) as never)}>
              <option value="">Not stated</option>
              {RISK_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <span className={label}>Exit preferences</span>
            <div className="flex flex-wrap gap-1.5">
              {EXIT_OPTIONS.map((o) => {
                const active = (form.exitPreferences || []).includes(o.value as never)
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleInArray('exitPreferences', o.value)}
                    aria-pressed={active}
                    className={cn('border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors', active ? 'border-gold bg-gold/15 text-primary' : 'border-border text-muted-foreground hover:border-gold/50')}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save criteria
        </button>
      </div>
    </div>
  )
}
