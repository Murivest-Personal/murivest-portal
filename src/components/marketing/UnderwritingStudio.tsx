'use client'

import {useId, useState} from 'react'
import Link from 'next/link'
import {motion} from 'framer-motion'
import {ArrowRight, Calculator, Loader2, RefreshCw, TriangleAlert} from 'lucide-react'
import {MARKET_ARCHETYPES, ARCHETYPE_BY_KEY, type DifferentialResult} from '@/lib/finance/differential'
import {fmtMoney, fmtPct, fmtRatio} from '@/lib/format'
import {EASE, TIMING} from '@/lib/motion'

/**
 * Differential Underwriting Studio — the public calculator.
 * An investor enters their property's location, income, lease, owner and
 * building specifics; the engine returns the three competing explanations
 * of value, the price to give (offer ladder), the price to set to let
 * (rent guidance) and the loan to access (DSCR debt sizing).
 *
 * Defaults preload the published worked example (a 49,000 sq ft Nairobi CBD
 * tower) so first-time visitors see the method, not an empty form.
 */

const DEMO = {
  propertyName: '',
  locationNote: '',
  archetype: '',
  currency: '',
  lettableArea: '',
  monthlyIncomeFullyLet: '',
  currentOccupancy: '',
  askingPrice: '',
  marketCapRate: '',
  targetOccupancy: '85',
  sellerStoryOpex: '30',
  opexInPlace: '45',
  opexStabilized: '35',
  fitOutPsf: '2000',
  downtimeMonths: '6',
  debtRate: '13.5',
  amortYears: '15',
  dscrFloor: '1.3',
  rentDeltaPsf: '0',
}

interface FormState {
  propertyName: string
  locationNote: string
  archetype: string
  currency: string
  lettableArea: string
  monthlyIncomeFullyLet: string
  currentOccupancy: string
  askingPrice: string
  marketCapRate: string
  targetOccupancy: string
  sellerStoryOpex: string
  opexInPlace: string
  opexStabilized: string
  fitOutPsf: string
  downtimeMonths: string
  debtRate: string
  amortYears: string
  dscrFloor: string
  rentDeltaPsf: string
}

const INPUT_CLS =
  'w-full rounded-[5px] border border-input bg-card px-3 py-2.5 text-sm text-foreground tabular transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none'
const LABEL_CLS = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground'

function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode = 'decimal',
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  inputMode?: 'decimal' | 'text'
  hint?: string
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLS}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        className={INPUT_CLS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {hint ? <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">{hint}</p> : null}
    </div>
  )
}

const reveal = {
  hidden: {opacity: 0, y: 14},
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {duration: TIMING.small, ease: EASE, delay: i * 0.05},
  }),
}

export function UnderwritingStudio() {
  const [form, setForm] = useState<FormState>(DEMO as FormState)
  const [result, setResult] = useState<DifferentialResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({...f, [k]: v}))

  const applyArchetype = (key: string) => {
    const a = ARCHETYPE_BY_KEY[key]
    if (!a) return
    setForm((f) => ({
      ...f,
      archetype: key,
      marketCapRate: String(a.capRatePct),
      debtRate: String(a.debtRatePct),
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = {
        propertyName: form.propertyName,
        locationNote: form.locationNote,
        archetype: form.archetype,
        currency: form.currency,
        lettableArea: Number(form.lettableArea),
        monthlyIncomeFullyLet: Number(form.monthlyIncomeFullyLet),
        currentOccupancyPct: Number(form.currentOccupancy),
        askingPrice: Number(form.askingPrice),
        marketCapRatePct: Number(form.marketCapRate),
        targetOccupancyPct: Number(form.targetOccupancy),
        sellerStoryOpexPct: Number(form.sellerStoryOpex),
        opexRatioInPlacePct: Number(form.opexInPlace),
        opexRatioStabilizedPct: Number(form.opexStabilized),
        fitOutPsf: Number(form.fitOutPsf),
        downtimeMonths: Number(form.downtimeMonths),
        debtRatePct: Number(form.debtRate),
        amortYears: Number(form.amortYears),
        dscrFloor: Number(form.dscrFloor),
        rentDeltaPsf: Number(form.rentDeltaPsf),
      }
      if (!payload.lettableArea || !payload.monthlyIncomeFullyLet || !payload.marketCapRatePct) {
        throw new Error('Area, fully-let monthly income and a market cap rate are required before the engine can run.')
      }
      const res = await fetch('/api/underwriting', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'The engine could not run this case.')
      setResult(data.result as DifferentialResult)
      requestAnimationFrame(() => {
        document.getElementById('differential-result')?.scrollIntoView({behavior: 'smooth', block: 'start'})
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Check the inputs and run it again.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setForm(DEMO as FormState)
    setResult(null)
    setError(null)
  }

  const r = result

  const money = (v: number | null | undefined) => (v == null ? '—' : fmtMoney(v, form.currency, {compact: true}))

  return (
    <div id="differential-studio" className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      {/* ============== INPUT PANEL ============== */}
      <form onSubmit={submit} className="rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-6 py-5">
          <div className="eyebrow">Inputs — the presenting asset</div>
          <h3 className="mt-1 font-display text-xl text-primary">Enter your property</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Location, income, occupancy, asking price, building size, the re-leasing plan and the debt market. The
            engine treats every figure you enter as a claim to be tested.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Property name" value={form.propertyName} onChange={set('propertyName')} inputMode="text" />
            <Field label="Location / submarket" value={form.locationNote} onChange={set('locationNote')} inputMode="text" hint="e.g. Nairobi CBD · Upper Hill · London City fringe" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="uw-archetype" className={LABEL_CLS}>
                Market archetype
              </label>
              <select
                id="uw-archetype"
                className={INPUT_CLS}
                value={form.archetype}
                onChange={(e) => applyArchetype(e.target.value)}
              >
                {MARKET_ARCHETYPES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">
                Pre-suggests a cap rate and debt rate — override both below with your own submarket evidence.
              </p>
            </div>
            <div>
              <label htmlFor="uw-currency" className={LABEL_CLS}>
                Currency
              </label>
              <select id="uw-currency" className={INPUT_CLS} value={form.currency} onChange={(e) => set('currency')(e.target.value)}>
                <option value="KES">KES — Kenya Shilling</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="my-2 border-t border-border/70" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lettable area (sq ft)" value={form.lettableArea} onChange={set('lettableArea')} hint="Total income-producing area." />
            <Field label="Income fully let (per month)" value={form.monthlyIncomeFullyLet} onChange={set('monthlyIncomeFullyLet')} hint="Gross potential rent at 100% occupancy." />
            <Field label="Current occupancy (%)" value={form.currentOccupancy} onChange={set('currentOccupancy')} hint="From the rent roll — never the brochure." />
            <Field label="Asking price" value={form.askingPrice} onChange={set('askingPrice')} hint="Zero if you only want a value view." />
          </div>

          <div className="my-2 border-t border-border/70" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Market cap rate (%)" value={form.marketCapRate} onChange={set('marketCapRate')} hint="Your submarket's price of risk — the anchor for every output." />
            <Field label="Target stabilized occupancy (%)" value={form.targetOccupancy} onChange={set('targetOccupancy')} />
            <Field label="Seller's story opex ratio (%)" value={form.sellerStoryOpex} onChange={set('sellerStoryOpex')} hint="The lean costs the brochure implies — the asking price's own hidden assumption." />
            <Field label="In-place opex ratio (%)" value={form.opexInPlace} onChange={set('opexInPlace')} hint="Fixed costs don't shrink with occupancy — usually higher than stabilized." />
            <Field label="Stabilized opex ratio (%)" value={form.opexStabilized} onChange={set('opexStabilized')} />
          </div>

          <details className="group rounded-[5px] border border-border bg-background/60 px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Re-leasing programme & debt terms
              <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">open to edit</span>
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Fit-out contribution (per sq ft re-let)" value={form.fitOutPsf} onChange={set('fitOutPsf')} />
              <Field label="Downtime / rent-free (months)" value={form.downtimeMonths} onChange={set('downtimeMonths')} />
              <Field label="Debt rate (% p.a.)" value={form.debtRate} onChange={set('debtRate')} />
              <Field label="Amortisation (years)" value={form.amortYears} onChange={set('amortYears')} />
              <Field label="DSCR floor (×)" value={form.dscrFloor} onChange={set('dscrFloor')} hint="Lenders typically require 1.20×–1.30× on stabilized income." />
              <Field label="Rent re-gear uplift (per sq ft / month)" value={form.rentDeltaPsf} onChange={set('rentDeltaPsf')} hint="Optional — runs the rent-delta value calculator." />
            </div>
          </details>

          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-[5px] border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-primary px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              {loading ? 'Running the differential…' : 'Run the differential underwrite'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-border px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Worked example
            </button>
          </div>
        </div>
      </form>

      {/* ============== RESULT PANEL ============== */}
      <div id="differential-result" className="min-w-0">
        {!r ? (
          <div className="rounded-[16px] border border-border bg-card px-6 py-10 shadow-[var(--shadow-card)]">
            <div className="eyebrow">Output</div>
            <h3 className="mt-1 font-display text-xl text-primary">The verdict the engine returns</h3>
            <ul className="mt-6 grid gap-3 text-sm leading-relaxed text-muted-foreground">
              {[
                'Three competing explanations of value — the seller\u2019s story, today\u2019s in-place reality, and the stabilized case net of the re-leasing programme.',
                'The price to give — an offer ladder anchored in basis points of defensible yield: opening offer, target zone, walk-away.',
                'The price to set to let — current rent versus the rent the asset must achieve to justify the asking price, and the re-gear uplift that closes the spread.',
                'The loan to access — the maximum supportable loan at your DSCR floor, the annual debt constant, and the DSCR tests the price must survive.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 border-l border-gold/40 pl-3">
                  <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
              Run the preloaded worked example first — a 49,000 sq ft Nairobi CBD tower asking KSh 800M at 40%
              occupancy — then swap in your own property. The arithmetic runs in the open; the assumptions are yours
              to defend.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Differential spread hero */}
            <motion.section
              custom={0}
              initial="hidden"
              animate="visible"
              variants={reveal}
              className="rounded-[16px] bg-forest-deep p-6 text-ivory shadow-[var(--shadow-card)] sm:p-8"
            >
              <div className="eyebrow !text-gold/80">The differential spread</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ivory/50">Asking price — the claim</div>
                  <div className="mt-1 font-display text-2xl tabular">{money(r.differential.consensusValue)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ivory/50">Differential value — net of programme</div>
                  <div className="mt-1 font-display text-2xl tabular text-gold">{money(r.differential.differentialValue)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ivory/50">The spread</div>
                  <div className="mt-1 font-display text-2xl tabular">
                    {r.differential.spread == null ? '—' : money(r.differential.spread)}
                    {r.differential.spreadPctOfAsking != null && (
                      <span className="ml-2 text-sm text-ivory/60">{fmtPct(r.differential.spreadPctOfAsking, 1)} of asking</span>
                    )}
                  </div>
                </div>
              </div>
              {r.flags.length > 0 ? (
                <ul className="mt-6 grid gap-2 border-t border-ivory/15 pt-5">
                  {r.flags.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs leading-relaxed text-ivory/75">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gold" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
            </motion.section>

            {/* Three explanations */}
            <motion.section
              custom={1}
              initial="hidden"
              animate="visible"
              variants={reveal}
              className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]"
            >
              <div className="border-b border-border px-6 py-5">
                <div className="eyebrow">Stage 5 — rule-out analysis</div>
                <h3 className="mt-1 font-display text-lg text-primary">Three competing explanations of value</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Scenario</th>
                      <th className="px-3 py-3 font-medium">Occupancy</th>
                      <th className="px-3 py-3 font-medium">Opex</th>
                      <th className="px-3 py-3 font-medium">NOI</th>
                      <th className="px-3 py-3 font-medium">Net value @{fmtPct(r.valueBand.capLowPct - 0.5 + 0.5, 1)}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {r.scenarios.map((s) => (
                      <tr key={s.key} className={`border-b border-border/60 ${s.key === 'C' ? 'bg-gold/5' : ''}`}>
                        <td className="px-6 py-3.5">
                          <div className="font-semibold text-primary">{s.key} — {s.label}</div>
                          {s.key === 'C' && r.reLeasingProgrammeCost > 0 ? (
                            <div className="text-[10px] text-muted-foreground">less {money(r.reLeasingProgrammeCost)} re-leasing programme</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3.5">{fmtPct(s.occupancyPct, 0)}</td>
                        <td className="px-3 py-3.5">{fmtPct(s.opexRatioPct, 0)}</td>
                        <td className="px-3 py-3.5">{money(s.noi)}</td>
                        <td className="px-3 py-3.5 font-semibold text-primary">{money(s.netValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 border-t border-border px-6 py-5 text-xs leading-relaxed text-muted-foreground sm:grid-cols-3">
                <p>
                  Cap-rate band: <span className="font-semibold text-primary">{money(r.valueBand.netValueLow)}</span> at{' '}
                  {fmtPct(r.valueBand.capLowPct, 1)} to <span className="font-semibold text-primary">{money(r.valueBand.netValueHigh)}</span> at{' '}
                  {fmtPct(r.valueBand.capHighPct, 1)}.
                </p>
                <p>
                  Implied cap rate at asking (stabilized NOI):{' '}
                  <span className="font-semibold text-primary">{r.impliedCapRateAtAskingPct == null ? '—' : fmtPct(r.impliedCapRateAtAskingPct, 2)}</span>.
                  In-place yield: <span className="font-semibold text-primary">{r.inPlaceYieldOnAskingPct == null ? '—' : fmtPct(r.inPlaceYieldOnAskingPct, 2)}</span>.
                </p>
                <p>
                  Execution value of closing the occupancy gap:{' '}
                  <span className="font-semibold text-primary">{money(r.differential.executionValue)}</span>. Yield on cost
                  at target: <span className="font-semibold text-primary">{fmtPct(r.yieldOnCostPct, 2)}</span>.
                </p>
              </div>
            </motion.section>

            {/* Offer ladder — price to give */}
            <motion.section
              custom={2}
              initial="hidden"
              animate="visible"
              variants={reveal}
              className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]"
            >
              <div className="border-b border-border px-6 py-5">
                <div className="eyebrow">Stage 7 — investment verdict</div>
                <h3 className="mt-1 font-display text-lg text-primary">The price to give — offer ladder</h3>
              </div>
              <div className="divide-y divide-border/60">
                {r.offerLadder.map((l, idx) => (
                  <div key={l.rung} className={`grid gap-2 px-6 py-4 sm:grid-cols-[130px_160px_110px_1fr] sm:items-center ${idx === 1 ? 'bg-gold/5' : ''}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{l.rung === 'target' ? 'Target zone' : l.rung === 'opening' ? 'Opening offer' : 'Walk-away'}</div>
                    <div className="font-display text-lg tabular text-primary">{money(l.price)}</div>
                    <div className="text-sm tabular text-muted-foreground">{fmtPct(l.stabilizedYieldPct, 2)}</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{l.note}</p>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Debt + rent guidance */}
            <motion.section
              custom={3}
              initial="hidden"
              animate="visible"
              variants={reveal}
              className="grid gap-6 rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:grid-cols-2 sm:p-8"
            >
              <div>
                <div className="eyebrow">Debt sizing</div>
                <h3 className="mt-1 font-display text-lg text-primary">The loan to access</h3>
                <ul className="mt-4 grid gap-3 text-sm">
                  <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Max loan at DSCR floor</span>
                    <span className="font-semibold tabular text-primary">{money(r.debt.maxSupportableLoan)}</span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Annual debt constant</span>
                    <span className="font-semibold tabular text-primary">{fmtPct(r.debt.annualDebtConstantPct, 2)}</span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Implied LTV at target price</span>
                    <span className="font-semibold tabular text-primary">{fmtPct(r.debt.impliedLtvPctOnTargetPrice, 1)}</span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">DSCR stabilized @ 60% LTV of asking</span>
                    <span className={`font-semibold tabular ${r.debt.dscrStabilizedAtAskingLtv60 != null && r.debt.dscrStabilizedAtAskingLtv60 < 1 ? 'text-destructive' : 'text-primary'}`}>
                      {r.debt.dscrStabilizedAtAskingLtv60 == null ? '—' : fmtRatio(r.debt.dscrStabilizedAtAskingLtv60)}
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">DSCR in-place @ 60% LTV of asking</span>
                    <span className={`font-semibold tabular ${r.debt.dscrInPlaceAtAskingLtv60 != null && r.debt.dscrInPlaceAtAskingLtv60 < 1 ? 'text-destructive' : 'text-primary'}`}>
                      {r.debt.dscrInPlaceAtAskingLtv60 == null ? '—' : fmtRatio(r.debt.dscrInPlaceAtAskingLtv60)}
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4">
                    <span className="text-muted-foreground">Breakeven occupancy (at max debt)</span>
                    <span className="font-semibold tabular text-primary">{fmtPct(r.breakevenOccupancyPct, 1)}</span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="eyebrow">Rent guidance</div>
                <h3 className="mt-1 font-display text-lg text-primary">The price to set to let</h3>
                <ul className="mt-4 grid gap-3 text-sm">
                  <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Current rent (per sq ft / month)</span>
                    <span className="font-semibold tabular text-primary">{r.currency === 'KES' ? 'KSh' : ''}{r.rentGuidance.currentRentPsfPerMonth.toLocaleString('en-GB', {maximumFractionDigits: 0})}</span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Rent required to justify asking</span>
                    <span className="font-semibold tabular text-primary">
                      {r.rentGuidance.requiredRentPsfToJustifyAsking == null
                        ? '—'
                        : `${r.currency === 'KES' ? 'KSh' : ''}${r.rentGuidance.requiredRentPsfToJustifyAsking.toLocaleString('en-GB', {maximumFractionDigits: 0})}`}
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Re-gear uplift that closes the spread</span>
                    <span className="font-semibold tabular text-primary">
                      {r.rentGuidance.upliftPsfToCloseSpread == null
                        ? '—'
                        : `${r.currency === 'KES' ? 'KSh' : ''}${r.rentGuidance.upliftPsfToCloseSpread.toLocaleString('en-GB', {maximumFractionDigits: 0})}`}
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4">
                    <span className="text-muted-foreground">Re-let area in the programme</span>
                    <span className="font-semibold tabular text-primary">{r.reLetArea.toLocaleString('en-GB', {maximumFractionDigits: 0})} sq ft</span>
                  </li>
                </ul>
                {r.rentDelta.deltaPsf > 0 ? (
                  <div className="mt-5 rounded-[5px] border border-gold/40 bg-gold/5 p-4 text-xs leading-relaxed text-muted-foreground">
                    Rent-delta calculator: a {r.currency === 'KES' ? 'KSh' : ''}{r.rentDelta.deltaPsf}/sq ft/month uplift capitalises to{' '}
                    <span className="font-semibold text-primary">{money(r.rentDelta.differentialValue)}</span> at the differential rule (net of opex) versus{' '}
                    <span className="font-semibold text-primary">{money(r.rentDelta.grossValue)}</span> on the naive gross rule — the gap is the price of
                    not knowing the opex structure.
                  </div>
                ) : null}
              </div>
            </motion.section>

            {/* CTA */}
            <motion.section
              custom={4}
              initial="hidden"
              animate="visible"
              variants={reveal}
              className="rounded-[16px] border border-gold/40 bg-gold/5 p-6 sm:p-8"
            >
              <h3 className="font-display text-lg text-primary">This is the sixty-second version. The mandate runs deeper.</h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                The public engine prices the arithmetic. A Murivest mandate adds the fourteen-document data room, the
                hypothesis register, the rule-out log, the estoppels and the title searches — the evidence that turns
                a band into a signed verdict. Request private access and run your next deal inside the workspace.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/?auth=required"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep"
                >
                  Request private access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/differential-underwriting"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-border px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  The method, explained
                </Link>
              </div>
            </motion.section>

            <p className="px-1 text-[10px] leading-relaxed text-muted-foreground/70">
              Illustrative computation from the figures you entered. Every assumption — occupancy path, opex ratios,
              cap rate band, re-leasing costs and debt terms — must be replaced by evidence in a formal Differential
              Investigation before any offer is made. Nothing here is investment advice, a valuation or an offer of
              finance.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
