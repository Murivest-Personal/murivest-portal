'use client'

import {useCallback, useState} from 'react'
import {Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'
import {Download} from 'lucide-react'
import {fmtMoney, fmtNumber} from '@/lib/format'
import {adminData} from './client'
import {SectionCard, MetricTile, EmptyState, DataTable, TrendPill} from './ui'
import {cn} from '@/lib/utils'

/**
 * Comprehensive analytics suite — investors, opportunities, orders, mandates,
 * engagement and operational health. All figures are computed from real
 * interaction tables for the selected period vs its preceding comparison.
 */

export interface AnalyticsPayload {
  period: {label: string; key: string}
  executive: {
    activeInvestors: {total: number; uhnwi: number; institutional: number; individual: number}
    newRegistrations: {current: number; previous: number; growthPct: number | null}
    verificationConversionPct: number | null
    activeMandates: number
    submittedMandates: number
    opportunities: {live: number; offMarket: number; auction: number; underOffer: number; total: number; source: string}
    openOrders: {count: number; valueUsd: number}
    avgFulfilmentHours: number | null
    pipeline: {weightedUsd: number; unweightedUsd: number}
    revenueUsd: number
    aovUsd: number | null
  }
  investors: {
    sources: {label: string; count: number}[]
    funnel: {stage: string; count: number}[]
    engagement: {userId: string; name: string; classification: string; logins: number; saved: number; scenarios: number; comparisons: number; lastLoginAt: string | null}[]
    highValue: {userId: string; name: string; totalOrders: number; revenueUsd: number; classification: string}[]
    dormant: {userId: string; name: string; email: string; lastLoginAt: string | null; daysSinceLogin: number | null; tier: string}[]
    engagementTotals: {logins: number; saved: number; scenarios: number}
  }
  opportunities: {
    perOpportunity: {sanityId: string; title: string | null; views: number; uniqueViewers: number; saves: number; orders: number; revenueUsd: number}[]
    topViewed: {sanityId: string; title: string | null; views: number}[]
    highestConversion: {sanityId: string; title: string | null; views: number; orders: number; conversionPct: number | null}[]
    studioUsage: {scenarios: number; comparisons: number; capitalGapRuns: number}
    demandByAssetClass: {label: string; count: number}[]
    demandByGeography: {label: string; count: number}[]
  }
  orders: {
    series: {label: string; count: number; valueUsd: number}[]
    statusCounts: {status: string; count: number; valueUsd: number}[]
    avgFulfilmentDays: number | null
    viewToOrderConversionPct: number | null
    viewsInPeriod: number
    ordersFromViews: number
    repeatOrderRatePct: number | null
    briefTypePerformance: {briefType: string; count: number; valueUsd: number; revenueUsd: number}[]
    avgOrderValueUsd: number | null
  }
  mandates: {
    volumeByStatus: {status: string; count: number}[]
    sizeDistribution: {bucket: string; count: number}[]
    winRatePct: number | null
    avgDaysToActivate: number | null
    avgDaysToClose: number | null
    byAdvisor: {advisorId: string | null; name: string; active: number; weightedUsd: number}[]
    stageDistribution: {stage: string; count: number; weightedUsd: number}[]
  }
  ops: {
    avgFirstResponseHours: number | null
    openEnquiries: number
    docViews: number
    docDownloads: number
    topDocuments: {sanityDocumentId: string; title: string | null; views: number; downloads: number}[]
    sessionsPerDay: {label: string; count: number}[]
    activeSessions: number
    failedLogins: number
  }
  advisors: {advisorId: string; name: string; assignedInvestors: number; activeMandates: number; ordersSupported: number; revenueUsd: number}[]
}

const PERIODS = [
  {key: '7d', label: '7D'},
  {key: '30d', label: '30D'},
  {key: 'quarter', label: 'Quarter'},
  {key: 'ytd', label: 'YTD'},
]

export default function AnalyticsWorkspace({initial, initialPeriod}: {initial: AnalyticsPayload; initialPeriod: string}) {
  const [period, setPeriod] = useState(initialPeriod)
  const [data, setData] = useState<AnalyticsPayload>(initial)
  const [loading, setLoading] = useState(false)
  const [section, setSection] = useState<'executive' | 'investors' | 'opportunities' | 'orders' | 'mandates' | 'ops'>('executive')

  const load = useCallback(async (key: string) => {
    setLoading(true)
    const res = await adminData<AnalyticsPayload>('analytics', {period: key})
    if (res.ok && res.data) setData(res.data)
    setLoading(false)
  }, [])

  const switchPeriod = (key: string) => {
    setPeriod(key)
    void load(key)
  }

  const {executive: exec, investors, opportunities, orders, mandates, ops, advisors} = data

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center gap-3">
          {loading ? <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">refreshing…</span> : null}
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{data.period.label}</span>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-2" role="tablist" aria-label="Analytics sections">
        {([
          ['executive', 'Executive'],
          ['investors', 'Investors'],
          ['opportunities', 'Opportunities'],
          ['orders', 'Orders & fulfilment'],
          ['mandates', 'Mandates & pipeline'],
          ['ops', 'Operational health'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            onClick={() => setSection(key)}
            className={cn('px-3 py-1.5 text-xs transition-colors', section === key ? 'border-b-2 border-gold font-medium text-primary' : 'text-muted-foreground hover:text-primary')}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'executive' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricTile label="Active investors" value={fmtNumber(exec.activeInvestors.total)} sub={`${exec.activeInvestors.uhnwi} UHNWI · ${exec.activeInvestors.institutional} inst.`} />
            <MetricTile label="New registrations" value={fmtNumber(exec.newRegistrations.current)} sub={`${exec.newRegistrations.previous} prior period`} trend={exec.newRegistrations.growthPct} />
            <MetricTile label="Verification conversion" value={exec.verificationConversionPct != null ? `${exec.verificationConversionPct}%` : '—'} sub="registered → verified" />
            <MetricTile label="Open orders" value={fmtNumber(exec.openOrders.count)} sub={fmtMoney(exec.openOrders.valueUsd)} />
            <MetricTile label="Weighted pipeline" value={fmtMoney(exec.pipeline.weightedUsd)} sub={`${exec.activeMandates} active mandates`} />
            <MetricTile label="Avg fulfilment" value={exec.avgFulfilmentHours != null ? `${(exec.avgFulfilmentHours / 24).toFixed(1)}d` : '—'} sub="order → delivery" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Advisor performance" description="Attribution: order advisor or investor's advisor of record">
              {advisors.length === 0 ? (
                <EmptyState title="No advisor activity yet" description="Assign advisors to investors to see attribution here." />
              ) : (
                <DataTable head={['Advisor', 'Investors', 'Mandates', 'Orders', 'Revenue']}>
                  {advisors.map((a) => (
                    <tr key={a.advisorId}>
                      <td className="pl-0 pr-3 text-xs font-medium text-primary">{a.name}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtNumber(a.assignedInvestors)}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtNumber(a.activeMandates)}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtNumber(a.ordersSupported)}</td>
                      <td className="px-3 text-xs tabular-nums">{a.revenueUsd > 0 ? fmtMoney(a.revenueUsd) : '—'}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>
            <SectionCard title="Opportunity mix" description={`Source: ${exec.opportunities.source === 'sanity' ? 'Sanity CMS' : exec.opportunities.source === 'meta' ? 'local governance records' : 'no inventory yet'}`}>
              <BarList rows={[
                {label: 'Live', value: exec.opportunities.live},
                {label: 'Off-market', value: exec.opportunities.offMarket},
                {label: 'Auction-linked', value: exec.opportunities.auction},
                {label: 'Under offer', value: exec.opportunities.underOffer},
              ]} />
            </SectionCard>
          </div>
        </div>
      ) : null}

      {section === 'investors' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricTile label="Logins (period)" value={fmtNumber(investors.engagementTotals.logins)} />
            <MetricTile label="Saved opportunities" value={fmtNumber(investors.engagementTotals.saved)} />
            <MetricTile label="Studio scenarios" value={fmtNumber(investors.engagementTotals.scenarios)} />
            <MetricTile label="Dormant (60d+)" value={fmtNumber(investors.dormant.length)} sub="verified investors" tone="warning" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Conversion funnel" description="Visit → Request Access → Verified → First Order / First Mandate">
              <BarList rows={investors.funnel.map((f) => ({label: f.stage, value: f.count}))} />
            </SectionCard>
            <SectionCard title="Acquisition sources" description="Self-reported at registration">
              {investors.sources.length === 0 ? <EmptyState title="No source data yet" /> : <BarList rows={investors.sources.map((s) => ({label: s.label, value: s.count}))} />}
            </SectionCard>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Engagement leaders" description="Logins, saves and studio usage in period">
              {investors.engagement.length === 0 ? (
                <EmptyState title="No engagement yet" description="Investor activity in the selected period will rank here." />
              ) : (
                <DataTable head={['Investor', 'Logins', 'Saves', 'Studio']}>
                  {investors.engagement.slice(0, 12).map((e) => (
                    <tr key={e.userId}>
                      <td className="pl-0 pr-3 text-xs font-medium text-primary">{e.name}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtNumber(e.logins)}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtNumber(e.saved)}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtNumber(e.scenarios + e.comparisons)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>
            <SectionCard title="High-value investors" description="Recognised revenue, all-time">
              {investors.highValue.length === 0 ? (
                <EmptyState title="No revenue yet" description="Investors with delivered, paid briefs rank here." />
              ) : (
                <DataTable head={['Investor', 'Orders', 'Revenue']}>
                  {investors.highValue.map((h) => (
                    <tr key={h.userId}>
                      <td className="pl-0 pr-3 text-xs font-medium text-primary">{h.name}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtNumber(h.totalOrders)}</td>
                      <td className="px-3 text-xs tabular-nums text-gold-deep">{fmtMoney(h.revenueUsd)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}

      {section === 'opportunities' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricTile label="Studio scenarios (period)" value={fmtNumber(opportunities.studioUsage.scenarios)} sub="capital-gap analysis proxy" />
            <MetricTile label="Comparisons built" value={fmtNumber(opportunities.studioUsage.comparisons)} />
            <MetricTile label="Views (period)" value={fmtNumber(opportunities.perOpportunity.reduce((a, o) => a + o.views, 0))} />
            <MetricTile label="Orders linked" value={fmtNumber(opportunities.perOpportunity.reduce((a, o) => a + o.orders, 0))} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Demand by asset class" description="From stated investor criteria">
              {opportunities.demandByAssetClass.length === 0 ? <EmptyState title="No criteria stated yet" /> : <BarList rows={opportunities.demandByAssetClass.map((d) => ({label: d.label.replace(/_/g, ' '), value: d.count}))} />}
            </SectionCard>
            <SectionCard title="Demand by geography" description="From stated investor criteria">
              {opportunities.demandByGeography.length === 0 ? <EmptyState title="No criteria stated yet" /> : <BarList rows={opportunities.demandByGeography.map((d) => ({label: d.label, value: d.count}))} />}
            </SectionCard>
          </div>
          <SectionCard title="Opportunity performance" description="Views, saves and orders per opportunity in period">
            {opportunities.perOpportunity.length === 0 ? (
              <EmptyState title="No opportunity engagement yet" description="Publish opportunities and track views, saves and brief orders here." />
            ) : (
              <DataTable head={['Opportunity', 'Views', 'Unique', 'Saves', 'Orders', 'Revenue']}>
                {opportunities.perOpportunity.slice(0, 15).map((o) => (
                  <tr key={o.sanityId}>
                    <td className="pl-0 pr-3 align-top text-xs">
                      <div className="max-w-64 truncate font-medium text-primary" title={o.sanityId}>{o.title ?? o.sanityId}</div>
                    </td>
                    <td className="px-3 text-xs tabular-nums">{fmtNumber(o.views)}</td>
                    <td className="px-3 text-xs tabular-nums">{fmtNumber(o.uniqueViewers)}</td>
                    <td className="px-3 text-xs tabular-nums">{fmtNumber(o.saves)}</td>
                    <td className="px-3 text-xs tabular-nums">{fmtNumber(o.orders)}</td>
                    <td className="px-3 text-xs tabular-nums">{o.revenueUsd > 0 ? fmtMoney(o.revenueUsd) : '—'}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>
        </div>
      ) : null}

      {section === 'orders' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <MetricTile label="Avg order value" value={orders.avgOrderValueUsd != null ? fmtMoney(orders.avgOrderValueUsd) : '—'} />
            <MetricTile label="Avg fulfilment" value={orders.avgFulfilmentDays != null ? `${orders.avgFulfilmentDays.toFixed(1)}d` : '—'} />
            <MetricTile label="View → order" value={orders.viewToOrderConversionPct != null ? `${orders.viewToOrderConversionPct}%` : '—'} sub={`${fmtNumber(orders.ordersFromViews)} orders / ${fmtNumber(orders.viewsInPeriod)} views`} />
            <MetricTile label="Repeat order rate" value={orders.repeatOrderRatePct != null ? `${orders.repeatOrderRatePct}%` : '—'} sub="investors ordering again" />
          </div>
          <SectionCard title="Order volume & value" description="Placed orders over the period">
            {orders.series.every((s) => s.count === 0) ? (
              <EmptyState title="No orders in this period" description="The volume chart will render as briefs are ordered." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={orders.series} margin={{top: 8, right: 8, left: 8, bottom: 0}}>
                    <CartesianGrid stroke="#e3ded2" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{fontSize: 10, fill: '#6d7a6f'}} tickLine={false} axisLine={{stroke: '#e3ded2'}} />
                    <YAxis yAxisId="left" tick={{fontSize: 10, fill: '#6d7a6f'}} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fill: '#6d7a6f'}} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{fontSize: 11, border: '1px solid #e3ded2', borderRadius: 0, background: '#ffffff'}} />
                    <Bar yAxisId="left" dataKey="count" fill="#1b4332" fillOpacity={0.85} name="Orders" isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="valueUsd" stroke="#96744f" strokeWidth={1.75} name="Value (USD)" dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Status distribution" description="All orders, current state">
              <BarList rows={orders.statusCounts.map((s) => ({label: s.status.replace(/_/g, ' '), value: s.count}))} />
            </SectionCard>
            <SectionCard title="Brief type performance" description="Volume, value and recognised revenue">
              {orders.briefTypePerformance.length === 0 ? <EmptyState title="No orders yet" /> : (
                <DataTable head={['Type', 'Orders', 'Value', 'Revenue']}>
                  {orders.briefTypePerformance.map((b) => (
                    <tr key={b.briefType}>
                      <td className="pl-0 pr-3 text-xs font-medium text-primary">{b.briefType.replace(/_/g, ' ')}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtNumber(b.count)}</td>
                      <td className="px-3 text-xs tabular-nums">{fmtMoney(b.valueUsd)}</td>
                      <td className="px-3 text-xs tabular-nums text-gold-deep">{b.revenueUsd > 0 ? fmtMoney(b.revenueUsd) : '—'}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}

      {section === 'mandates' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricTile label="Active mandates" value={fmtNumber(exec.activeMandates)} />
            <MetricTile label="Win rate" value={mandates.winRatePct != null ? `${mandates.winRatePct}%` : '—'} sub="closed vs closed+rejected" />
            <MetricTile label="Avg days to activate" value={mandates.avgDaysToActivate != null ? mandates.avgDaysToActivate.toFixed(1) : '—'} />
            <MetricTile label="Avg days to close" value={mandates.avgDaysToClose != null ? mandates.avgDaysToClose.toFixed(1) : '—'} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard title="Volume by status">
              <BarList rows={mandates.volumeByStatus.map((m) => ({label: m.status, value: m.count}))} />
            </SectionCard>
            <SectionCard title="Size distribution" description="Midpoint of target allocation (USD)">
              <BarList rows={mandates.sizeDistribution.map((m) => ({label: m.bucket, value: m.count}))} />
            </SectionCard>
            <SectionCard title="Weighted pipeline by stage" description="Active USD mandates">
              {mandates.stageDistribution.length === 0 ? <EmptyState title="No active mandates with allocations" /> : (
                <BarList rows={mandates.stageDistribution.map((m) => ({label: m.stage.replace(/_/g, ' '), value: m.weightedUsd}))} format="money" />
              )}
            </SectionCard>
          </div>
          <SectionCard title="Advisor attribution" description="Active mandates and weighted pipeline">
            {mandates.byAdvisor.length === 0 ? <EmptyState title="No attributed mandates yet" /> : (
              <DataTable head={['Advisor', 'Active mandates', 'Weighted pipeline']}>
                {mandates.byAdvisor.map((a) => (
                  <tr key={a.advisorId ?? 'unassigned'}>
                    <td className="pl-0 pr-3 text-xs font-medium text-primary">{a.name}</td>
                    <td className="px-3 text-xs tabular-nums">{fmtNumber(a.active)}</td>
                    <td className="px-3 text-xs tabular-nums">{fmtMoney(a.weightedUsd)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>
        </div>
      ) : null}

      {section === 'ops' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <MetricTile label="First response" value={ops.avgFirstResponseHours != null ? `${ops.avgFirstResponseHours.toFixed(1)}h` : '—'} sub="enquiry → advisor reply" />
            <MetricTile label="Open enquiries" value={fmtNumber(ops.openEnquiries)} />
            <MetricTile label="Doc views" value={fmtNumber(ops.docViews)} />
            <MetricTile label="Doc downloads" value={fmtNumber(ops.docDownloads)} />
            <MetricTile label="Active sessions" value={fmtNumber(ops.activeSessions)} />
            <MetricTile label="Failed logins" value={fmtNumber(ops.failedLogins)} tone={ops.failedLogins > 10 ? 'warning' : 'neutral'} />
          </div>
          <SectionCard title="System usage" description="New sessions per day">
            {ops.sessionsPerDay.every((s) => s.count === 0) ? (
              <EmptyState title="No sessions in this period" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ops.sessionsPerDay} margin={{top: 8, right: 8, left: 8, bottom: 0}}>
                    <defs>
                      <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1b4332" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#1b4332" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e3ded2" strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{fontSize: 10, fill: '#6d7a6f'}} tickLine={false} axisLine={{stroke: '#e3ded2'}} />
                    <YAxis tick={{fontSize: 10, fill: '#6d7a6f'}} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{fontSize: 11, border: '1px solid #e3ded2', borderRadius: 0, background: '#ffffff'}} />
                    <Area type="monotone" dataKey="count" stroke="#1b4332" strokeWidth={1.75} fill="url(#sessionsGradient)" name="Sessions" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
          <SectionCard title="Document access patterns" description="Most-accessed documents in period">
            {ops.topDocuments.length === 0 ? <EmptyState title="No document access yet" /> : (
              <DataTable head={['Document', 'Views', 'Downloads']}>
                {ops.topDocuments.map((d) => (
                  <tr key={d.sanityDocumentId}>
                    <td className="pl-0 pr-3 text-xs font-medium text-primary">{d.title ?? d.sanityDocumentId}</td>
                    <td className="px-3 text-xs tabular-nums">{fmtNumber(d.views)}</td>
                    <td className="px-3 text-xs tabular-nums">{fmtNumber(d.downloads)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  )
}

function BarList({rows, format}: {rows: {label: string; value: number}[]; format?: 'money'}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate capitalize text-primary">{r.label}</span>
            <span className="tabular-nums text-gold-deep">{format === 'money' ? fmtMoney(r.value) : fmtNumber(r.value)}</span>
          </div>
          <div className="mt-1 h-1 w-full bg-secondary">
            <div className="h-full bg-gold/70" style={{width: `${Math.max(2, (r.value / max) * 100)}%`}} />
          </div>
        </li>
      ))}
    </ul>
  )
}
