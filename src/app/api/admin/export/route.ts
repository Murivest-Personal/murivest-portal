import {type NextRequest} from 'next/server'
import {requireAdminApi, isAdminResponse} from '@/lib/admin/rbac'
import {resolvePeriod} from '@/lib/admin/period'
import {orderList, investorList, mandateList, opportunityInventory, auditViewer} from '@/lib/admin/queries'
import {revenueCardMetrics, revenueBreakdowns, pipelineRevenue, unitEconomics, cohortRevenue} from '@/lib/admin/revenue'
import {fail} from '@/lib/api'

/**
 * Admin export API — CSV for leadership / finance / board use.
 * GET /api/admin/export?dataset=<orders|revenue|investors|mandates|opportunities|audit>&period=30d
 *
 * Every dataset is permission-checked against the RBAC matrix before rows
 * are serialised. CSV is generated server-side with proper escaping.
 */
function csvEscape(v: unknown): string {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  return lines.join('\n')
}

function csvResponse(csv: string, filename: string): Response {
  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const dataset = sp.get('dataset') ?? 'orders'
  const period = resolvePeriod(sp.get('period') ?? undefined, sp.get('from') ?? undefined, sp.get('to') ?? undefined)
  const stamp = new Date().toISOString().slice(0, 10)

  const guard = await requireAdminApi('export.data')
  if (isAdminResponse(guard)) return guard.response
  const {actx} = guard

  switch (dataset) {
    case 'orders': {
      if (!actx.can(actx.can('orders.view.all') ? 'orders.view.all' : 'orders.view.assigned')) return fail('Permission denied.', 403)
      const orders = await orderList(actx, {limit: 5000})
      return csvResponse(
        toCsv(orders.map((o) => ({
          reference: o.reference,
          investor: o.investorName,
          email: o.investorEmail,
          organisation: o.organisationName ?? '',
          brief: o.briefTitle,
          type: o.briefType,
          source: o.briefSource,
          format: o.format,
          status: o.status,
          priority: o.priority,
          assigned: o.assignedToId ? 'yes' : 'no',
          amountUsd: o.amountUsd,
          amountKes: o.amountKes,
          currency: o.currency,
          paymentStatus: o.payment?.status ?? '',
          createdAt: o.createdAt,
          deliveredAt: o.deliveredAt ?? '',
          closedAt: o.closedAt ?? '',
        }))),
        `murivest-orders-${stamp}.csv`,
      )
    }
    case 'revenue': {
      if (!actx.can('revenue.view')) return fail('Permission denied.', 403)
      const [card, breakdowns, pipeline, units, cohorts] = await Promise.all([
        revenueCardMetrics(period),
        revenueBreakdowns(period),
        pipelineRevenue(),
        unitEconomics(period),
        cohortRevenue(),
      ])
      const csv = [
        `Murivest Private Capital Portal — Revenue Report,${period.label},generated ${new Date().toISOString()}`,
        '',
        'PRIMARY METRICS (recognised on delivery + verified payment)',
        `Gross revenue (USD),${card.grossUsd}`,
        `Gross revenue (KES),${card.grossKes}`,
        `Net revenue (USD),${card.netUsd}`,
        `Processing costs (USD),${card.processingUsd}`,
        `Refunds (USD),${card.refundUsd}`,
        `Cash collected (USD),${card.cashCollectedUsd}`,
        `Open order value (USD),${card.openOrderValueUsd}`,
        `Open orders,${card.openOrderCount}`,
        `Orders completed,${card.ordersCompleted}`,
        `Average order value (USD),${card.aovUsd ?? ''}`,
        `Growth vs previous period (%),${card.revenueGrowthPct ?? ''}`,
        '',
        'REVENUE BY BRIEF TYPE',
        'type,value_usd,orders',
        ...breakdowns.byBriefType.map((r) => `${csvEscape(r.label)},${r.valueUsd},${r.count}`),
        '',
        'REVENUE BY OPPORTUNITY SOURCE',
        'source,value_usd,orders',
        ...breakdowns.bySource.map((r) => `${csvEscape(r.label)},${r.valueUsd},${r.count}`),
        '',
        'REVENUE BY INVESTOR TYPE',
        'type,value_usd,orders',
        ...breakdowns.byInvestorType.map((r) => `${csvEscape(r.label)},${r.valueUsd},${r.count}`),
        '',
        'REVENUE BY GEOGRAPHY',
        'country,value_usd,orders',
        ...breakdowns.byGeography.map((r) => `${csvEscape(r.label)},${r.valueUsd},${r.count}`),
        '',
        'REVENUE BY ADVISOR (ATTRIBUTION)',
        'advisor,value_usd,orders',
        ...breakdowns.byAdvisor.map((r) => `${csvEscape(r.label)},${r.valueUsd},${r.count}`),
        '',
        'PIPELINE REVENUE',
        `Weighted pipeline (USD),${pipeline.weightedUsd}`,
        `Unweighted pipeline (USD),${pipeline.unweightedUsd}`,
        `Active mandates,${pipeline.mandateCount}`,
        `Expected from open orders (USD),${pipeline.expectedOpenOrdersUsd}`,
        `Forecast conservative (USD),${pipeline.forecast.conservativeUsd}`,
        `Forecast base (USD),${pipeline.forecast.baseUsd}`,
        `Forecast upside (USD),${pipeline.forecast.upsideUsd}`,
        '',
        'UNIT ECONOMICS',
        `Revenue per active investor (USD),${units.revenuePerActiveInvestorUsd ?? ''}`,
        `Revenue per verified investor (USD),${units.revenuePerVerifiedInvestorUsd ?? ''}`,
        `Active investors,${units.activeInvestors}`,
        `Verified investors,${units.verifiedInvestors}`,
        '',
        'COHORT REVENUE (registration cohort, all-time recognised)',
        'cohort,investors,revenue_usd,avg_days_to_first_revenue',
        ...cohorts.map((c) => `${c.cohort},${c.investors},${c.revenueUsd},${c.firstOrderToRevenueDays ?? ''}`),
      ].join('\n')
      return csvResponse(csv, `murivest-revenue-${stamp}.csv`)
    }
    case 'investors': {
      if (!actx.can(actx.can('investors.view.all') ? 'investors.view.all' : 'investors.view.assigned')) return fail('Permission denied.', 403)
      const investors = await investorList(actx, {limit: 5000})
      return csvResponse(
        toCsv(investors.map((i) => ({
          email: i.email,
          name: i.fullName ?? '',
          accountStatus: i.status,
          classification: i.classification,
          verification: i.verificationStatus,
          kyc: i.kycStatus,
          aml: i.amlStatus,
          tier: i.accessTier,
          nda: i.ndaAccepted ? 'accepted' : 'not accepted',
          organisation: i.organisationName ?? '',
          country: i.countryResidence ?? '',
          source: i.source ?? '',
          equityAvailable: i.equityAvailable ?? '',
          totalCapacity: i.totalCapacity ?? '',
          capitalCurrency: i.capitalCurrency,
          orders: i.orderCount,
          recognisedRevenueUsd: i.revenueUsd,
          activeMandates: i.activeMandates,
          lastLoginAt: i.lastLoginAt ?? '',
          registeredAt: i.createdAt,
        }))),
        `murivest-investors-${stamp}.csv`,
      )
    }
    case 'mandates': {
      if (!actx.can('mandates.view')) return fail('Permission denied.', 403)
      const mandates = await mandateList(actx, {limit: 5000})
      return csvResponse(
        toCsv(mandates.map((m) => ({
          reference: m.reference,
          title: m.title,
          investor: m.investorName,
          email: m.investorEmail,
          status: m.status,
          stage: m.stage,
          probability: m.probability,
          nextAction: m.nextAction ?? '',
          nextActionDue: m.nextActionDue ?? '',
          allocationMin: m.targetAllocationMin ?? '',
          allocationMax: m.targetAllocationMax ?? '',
          currency: m.currency,
          geographies: JSON.stringify(m.geographies ?? []),
          assetClasses: JSON.stringify(m.assetClasses ?? []),
          advisor: m.advisorName ?? '',
          createdAt: m.createdAt,
          activatedAt: m.activatedAt ?? '',
          closedAt: m.closedAt ?? '',
        }))),
        `murivest-mandates-${stamp}.csv`,
      )
    }
    case 'opportunities': {
      if (!actx.can('opportunities.view')) return fail('Permission denied.', 403)
      const {rows} = await opportunityInventory()
      return csvResponse(
        toCsv(rows.map((o) => ({
          sanityId: o.sanityId,
          title: o.title,
          status: o.status,
          governanceStatus: o.metaStatus ?? 'live',
          accessTier: o.accessTier,
          governanceTier: o.metaVisibilityTier ?? '',
          assetClass: o.assetClass ?? '',
          country: o.geography?.country ?? '',
          city: o.geography?.city ?? '',
          price: o.indicativePrice?.amount ?? '',
          priceCurrency: o.indicativePrice?.currency ?? '',
          views: o.views,
          uniqueViewers: o.uniqueViewers,
          saves: o.saves,
          orders: o.orders,
          recognisedRevenueUsd: o.revenueUsd,
          tags: o.metaTags.join('|'),
          publishDate: o.publishDate ?? '',
        }))),
        `murivest-opportunities-${stamp}.csv`,
      )
    }
    case 'audit': {
      if (!actx.can('audit.view')) return fail('Permission denied.', 403)
      const logs = await auditViewer({limit: 5000})
      return csvResponse(
        toCsv(logs.map((l) => ({
          timestamp: l.createdAt,
          action: l.action,
          entity: l.entity ?? '',
          entityId: l.entityId ?? '',
          actorType: l.actorType,
          actor: l.actorName ?? '',
          ip: l.ip ?? '',
          detail: l.detail ?? '',
        }))),
        `murivest-audit-${stamp}.csv`,
      )
    }
    default:
      return fail('Unknown dataset.')
  }
}
