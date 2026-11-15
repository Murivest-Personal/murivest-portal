'use client'

import {useCallback, useState} from 'react'
import Link from 'next/link'
import {Area, AreaChart, ResponsiveContainer, YAxis} from 'recharts'
import {Download, Printer, ArrowUpRight, CircleDollarSign} from 'lucide-react'
import {cn} from '@/lib/utils'
import {fmtMoney, fmtNumber} from '@/lib/format'
import {adminData} from './client'
import {SectionCard, TrendPill, EmptyState} from './ui'

/**
 * The Revenue Card — permanent, high-visibility financial instrument on the
 * Command Centre and the dedicated Finance view.
 *
 * RECOGNITION: gross revenue is recognised when an order is delivered AND its
 * payment is verified. Cash collected (verified payments) is shown alongside,
 * clearly labelled. All figures reconcile to the orders + payments tables.
 */

export interface RevenueCardData {
  card: {
    periodLabel: string
    grossUsd: number
    grossKes: number
    netUsd: number
    processingUsd: number
    refundUsd: number
    cashCollectedUsd: number
    openOrderValueUsd: number
    openOrderCount: number
    aovUsd: number | null
    ordersCompleted: number
    revenueGrowthPct: number | null
    revenueGrowthUsd: number
    topSource: {dimension: string; label: string; valueUsd: number} | null
    series: {label: string; grossUsd: number; netUsd: number}[]
    feesConfigured: boolean
  }
  breakdowns?: {
    byBriefType: {label: string; valueUsd: number; count: number}[]
    bySource: {label: string; valueUsd: number; count: number}[]
    byInvestorType: {label: string; valueUsd: number; count: number}[]
    byGeography: {label: string; valueUsd: number; count: number}[]
    byAdvisor: {label: string; valueUsd: number; count: number}[]
    monthly: {label: string; grossUsd: number; netUsd: number}[]
  }
  pipeline?: {
    weightedUsd: number
    unweightedUsd: number
    mandateCount: number
    expectedOpenOrdersUsd: number
    openOrderCount: number
    byStage: {stage: string; count: number; valueUsd: number}[]
    forecast: {conservativeUsd: number; baseUsd: number; upsideUsd: number; assumptions: string[]}
  }
  units?: {
    revenuePerActiveInvestorUsd: number | null
    revenuePerVerifiedInvestorUsd: number | null
    activeInvestors: number
    verifiedInvestors: number
    avgFulfilmentCostUsd: number | null
    contributionMarginPct: number | null
  }
  cash?: {cashCollectedUsd: number; recognisedUsd: number; differenceUsd: number}
  cohorts?: {cohort: string; investors: number; revenueUsd: number; firstOrderToRevenueDays: number | null}[]
}

const PERIODS: {key: string; label: string}[] = [
  {key: 'today', label: 'Today'},
  {key: '7d', label: '7D'},
  {key: '30d', label: '30D'},
  {key: 'quarter', label: 'Quarter'},
  {key: 'ytd', label: 'YTD'},
]

export default function RevenueCard({
  initial,
  variant = 'compact',
  canExport = false,
}: {
  initial: RevenueCardData
  variant?: 'compact' | 'full'
  canExport?: boolean
}) {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<RevenueCardData>(initial)
  const [primary, setPrimary] = useState<'gross' | 'net'>('gross')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (key: string) => {
    setLoading(true)
    setError('')
    const res = await adminData<RevenueCardData>('revenue', {period: key})
    if (res.ok && res.data) setData(res.data)
    else if (!res.ok) setError(res.error ?? 'Failed to load revenue.')
    setLoading(false)
  }, [])

  const switchPeriod = (key: string) => {
    setPeriod(key)
    void load(key)
  }

  const c = data.card
  const primaryValue = primary === 'gross' ? c.grossUsd : c.netUsd
  const series = c.series.map((s) => ({...s, [primary]: primary === 'gross' ? s.grossUsd : s.netUsd}))
  const hasSeries = c.series.some((s) => s.grossUsd > 0 || s.netUsd > 0)

  return (
    <SectionCard
      title="Revenue"
      description={`${c.periodLabel} · recognised on delivery + verified payment${c.feesConfigured ? '' : ' · processing-cost schedule not configured (shown as 0)'}`}
      className={cn('border-gold/30', variant === 'full' ? '' : 'bg-gradient-to-br from-card via-card to-accent/30')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-border" role="group" aria-label="Primary metric">
            {(['gross', 'net'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPrimary(m)}
                className={cn('px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors', primary === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary')}
              >
                {m === 'gross' ? 'Gross' : 'Net'}
              </button>
            ))}
          </div>
          {canExport ? (
            <>
              <a
                href={`/api/admin/export?dataset=revenue&period=${period}`}
                className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:border-gold hover:text-gold"
              >
                <Download className="h-3 w-3" /> CSV
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:border-gold hover:text-gold"
              >
                <Printer className="h-3 w-3" /> PDF
              </button>
            </>
          ) : null}
        </div>
      }
    >
      {/* Period selector */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap border border-border" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => switchPeriod(p.key)}
              className={cn('px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors', period === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary')}
            >
              {p.label}
            </button>
          ))}
        </div>
        {loading ? <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">refreshing…</span> : null}
      </div>

      {error ? <p className="mb-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}

      {/* Primary number + sparkline */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {primary === 'gross' ? 'Gross revenue (recognised)' : 'Net revenue (after costs & refunds)'}
          </div>
          <div className="mt-1 font-display text-4xl text-primary tabular-nums sm:text-5xl">{fmtMoney(primaryValue, 'USD')}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <TrendPill value={c.revenueGrowthPct} />
            <span className="text-xs text-muted-foreground">
              {c.revenueGrowthUsd >= 0 ? '+' : '−'}
              {fmtMoney(Math.abs(c.revenueGrowthUsd), 'USD')} vs previous period
            </span>
          </div>
          {c.grossKes > 0 ? <div className="mt-2 text-xs text-muted-foreground">KES gross {fmtMoney(c.grossKes, 'KES')}</div> : null}
          {c.topSource ? (
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Top revenue source</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-primary">
                <CircleDollarSign className="h-3.5 w-3.5 text-gold" />
                <span className="font-medium">{c.topSource.label}</span>
                <span className="text-muted-foreground">· {c.topSource.dimension}</span>
                <span className="tabular-nums text-gold-deep">{fmtMoney(c.topSource.valueUsd, 'USD')}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="h-36 sm:h-44">
          {hasSeries ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{top: 8, right: 8, left: 8, bottom: 0}}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1b4332" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#1b4332" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, 'dataMax']} />
                <Area type="monotone" dataKey={primary} stroke="#1b4332" strokeWidth={1.75} fill="url(#revGradient)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
              No recognised revenue in this period yet
            </div>
          )}
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {[
          {label: 'Net revenue', value: fmtMoney(c.netUsd), hint: 'after costs & refunds'},
          {label: 'Cash collected', value: fmtMoney(c.cashCollectedUsd), hint: 'verified payments'},
          {label: 'Open order value', value: fmtMoney(c.openOrderValueUsd), hint: `${fmtNumber(c.openOrderCount)} in fulfilment`},
          {label: 'Avg order value', value: c.aovUsd != null ? fmtMoney(c.aovUsd) : '—', hint: 'completed paid briefs'},
          {label: 'Orders completed', value: fmtNumber(c.ordersCompleted), hint: 'delivered in period'},
          {label: 'Refunds', value: fmtMoney(c.refundUsd), hint: 'approved adjustments'},
        ].map((m) => (
          <div key={m.label} className="bg-card p-3.5">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{m.label}</div>
            <div className="mt-1 font-display text-lg text-primary tabular-nums">{m.value}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{m.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>Recognised vs collected are kept distinct</span>
        <Link href="/admin/orders?status=delivered" className="inline-flex items-center gap-1 text-primary hover:text-gold">
          Drill into delivered orders <ArrowUpRight className="h-3 w-3" />
        </Link>
        <Link href="/admin/finance" className="inline-flex items-center gap-1 text-primary hover:text-gold">
          Full finance view <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Full variant: breakdowns, pipeline, unit economics, cohorts */}
      {variant === 'full' && data.breakdowns ? <RevenueBreakdowns data={data} /> : null}
    </SectionCard>
  )
}

function BreakdownList({title, rows}: {title: string; rows: {label: string; valueUsd: number; count: number}[]}) {
  const max = Math.max(...rows.map((r) => r.valueUsd), 1)
  return (
    <div>
      <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recognised revenue in this period.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-primary">{r.label}</span>
                <span className="tabular-nums text-gold-deep">{fmtMoney(r.valueUsd)}</span>
              </div>
              <div className="mt-1 h-1 w-full bg-secondary">
                <div className="h-full bg-gold/70" style={{width: `${Math.max(2, (r.valueUsd / max) * 100)}%`}} />
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{r.count} order{r.count === 1 ? '' : 's'}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RevenueBreakdowns({data}: {data: RevenueCardData}) {
  const [tab, setTab] = useState<'brief' | 'source' | 'investor' | 'geo' | 'advisor' | 'monthly'>('brief')
  const b = data.breakdowns!
  const tabs = [
    {key: 'brief' as const, label: 'Brief type', rows: b.byBriefType},
    {key: 'source' as const, label: 'Source', rows: b.bySource},
    {key: 'investor' as const, label: 'Investor type', rows: b.byInvestorType},
    {key: 'geo' as const, label: 'Geography', rows: b.byGeography},
    {key: 'advisor' as const, label: 'Advisor', rows: b.byAdvisor},
  ]

  return (
    <div className="mt-8 space-y-8">
      {/* Breakdown tabs */}
      <div>
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2" role="tablist" aria-label="Revenue breakdowns">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn('px-3 py-1.5 text-xs transition-colors', tab === t.key ? 'border-b-2 border-gold font-medium text-primary' : 'text-muted-foreground hover:text-primary')}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'monthly'}
            onClick={() => setTab('monthly')}
            className={cn('px-3 py-1.5 text-xs transition-colors', tab === 'monthly' ? 'border-b-2 border-gold font-medium text-primary' : 'text-muted-foreground hover:text-primary')}
          >
            Monthly (12M)
          </button>
        </div>
        {tab === 'monthly' ? (
          b.monthly.length === 0 ? (
            <EmptyState title="No revenue history yet" description="Recognised revenue will chart here as briefs are delivered." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={b.monthly} margin={{top: 8, right: 8, left: 8, bottom: 0}}>
                  <defs>
                    <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b8956b" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#b8956b" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={[0, 'dataMax']} />
                  <Area type="monotone" dataKey="grossUsd" stroke="#96744f" strokeWidth={1.75} fill="url(#monthlyGradient)" name="Gross" isAnimationActive={false} />
                  <Area type="monotone" dataKey="netUsd" stroke="#1b4332" strokeWidth={1.75} fillOpacity={0} name="Net" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gold-deep" /> Gross</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-forest" /> Net</span>
                <span>trailing 12 months</span>
              </div>
            </div>
          )
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {tabs.map((t) => (
              <div key={t.key} className={cn(tab !== t.key && 'hidden lg:hidden')}>
                <BreakdownList title={t.label} rows={t.rows} />
              </div>
            ))}
            <div className={cn(tab !== 'brief' && 'lg:hidden')}>
              <BreakdownList title={tabs.find((t) => t.key === tab)?.label ?? ''} rows={(tabs.find((t) => t.key === tab)?.rows ?? [])} />
            </div>
          </div>
        )}
      </div>

      {/* Pipeline revenue */}
      {data.pipeline ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="border border-border bg-card p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Weighted pipeline (active mandates)</div>
            <div className="mt-1 font-display text-3xl text-primary tabular-nums">{fmtMoney(data.pipeline.weightedUsd)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data.pipeline.mandateCount} active USD mandates · unweighted {fmtMoney(data.pipeline.unweightedUsd)}
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Expected from open orders</dt>
                <dd className="tabular-nums text-primary">{fmtMoney(data.pipeline.expectedOpenOrdersUsd)}</dd>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Forecast · conservative</dt>
                <dd className="tabular-nums text-primary">{fmtMoney(data.pipeline.forecast.conservativeUsd)}</dd>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Forecast · base</dt>
                <dd className="tabular-nums text-primary">{fmtMoney(data.pipeline.forecast.baseUsd)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Forecast · upside</dt>
                <dd className="tabular-nums text-primary">{fmtMoney(data.pipeline.forecast.upsideUsd)}</dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
              {data.pipeline.forecast.assumptions.map((a) => (
                <li key={a}>· {a}</li>
              ))}
            </ul>
          </div>
          <div className="border border-border bg-card p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Pipeline by stage</div>
            {data.pipeline.byStage.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">No active USD mandates with stated allocations.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {data.pipeline.byStage.map((s) => {
                  const max = Math.max(...data.pipeline!.byStage.map((x) => x.valueUsd), 1)
                  return (
                    <li key={s.stage}>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="capitalize text-primary">{s.stage.replace(/_/g, ' ')}</span>
                        <span className="tabular-nums text-gold-deep">{fmtMoney(s.valueUsd)}</span>
                      </div>
                      <div className="mt-1 h-1 w-full bg-secondary">
                        <div className="h-full bg-forest/70" style={{width: `${Math.max(2, (s.valueUsd / max) * 100)}%`}} />
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{s.count} mandate{s.count === 1 ? '' : 's'}</div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* Unit economics + reconciliation + cohorts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {data.units ? (
          <div className="border border-border bg-card p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Unit economics</div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Revenue / active investor</dt>
                <dd className="tabular-nums text-primary">{data.units.revenuePerActiveInvestorUsd != null ? fmtMoney(data.units.revenuePerActiveInvestorUsd) : '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Revenue / verified investor</dt>
                <dd className="tabular-nums text-primary">{data.units.revenuePerVerifiedInvestorUsd != null ? fmtMoney(data.units.revenuePerVerifiedInvestorUsd) : '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Avg fulfilment cost</dt>
                <dd className="tabular-nums text-primary">{data.units.avgFulfilmentCostUsd != null ? fmtMoney(data.units.avgFulfilmentCostUsd) : 'not entered'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Contribution margin</dt>
                <dd className="tabular-nums text-primary">{data.units.contributionMarginPct != null ? `${data.units.contributionMarginPct.toFixed(1)}%` : '—'}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Fulfilment cost is entered by Finance (Settings → finance.avg_fulfilment_cost_usd); margins appear only when cost data exists.
            </p>
          </div>
        ) : null}
        {data.cash ? (
          <div className="border border-border bg-card p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Cash vs recognised</div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Cash collected</dt>
                <dd className="tabular-nums text-primary">{fmtMoney(data.cash.cashCollectedUsd)}</dd>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Recognised revenue</dt>
                <dd className="tabular-nums text-primary">{fmtMoney(data.cash.recognisedUsd)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Difference (deferred / in transit)</dt>
                <dd className="tabular-nums text-gold-deep">{fmtMoney(data.cash.differenceUsd)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        {data.cohorts && data.cohorts.length > 0 ? (
          <div className="border border-border bg-card p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Cohort revenue (registration month)</div>
            <ul className="mt-3 space-y-2 text-xs">
              {data.cohorts.slice(-8).reverse().map((c) => (
                <li key={c.cohort} className="flex items-center justify-between border-b border-border/60 pb-1.5">
                  <span className="text-primary">{c.cohort}</span>
                  <span className="text-muted-foreground">{c.investors} inv.</span>
                  <span className="tabular-nums text-gold-deep">{fmtMoney(c.revenueUsd)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
