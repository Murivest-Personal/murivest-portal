import {type NextRequest} from 'next/server'
import {requireAdminApi, isAdminResponse} from '@/lib/admin/rbac'
import {resolvePeriod} from '@/lib/admin/period'
import * as queries from '@/lib/admin/queries'
import * as analytics from '@/lib/admin/analytics'
import {revenueCardMetrics, revenueBreakdowns, pipelineRevenue, unitEconomics, cohortRevenue, cashVersusRecognised} from '@/lib/admin/revenue'
import {fail} from '@/lib/api'

/**
 * Admin read API — one guarded dispatcher for every module scope.
 * GET /api/admin/data?scope=<module>&period=30d&...
 *
 * Permissions and advisor scoping are enforced per scope (RBAC matrix in
 * src/lib/admin/rbac.ts; the same posture is enforced at the DB level by
 * sql/005_admin_rls.sql in production).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const sp = url.searchParams
  const scope = sp.get('scope') ?? 'overview'
  const period = resolvePeriod(sp.get('period') ?? undefined, sp.get('from') ?? undefined, sp.get('to') ?? undefined)

  // Resolve the acting context once (401 if not staff).
  const guard = await requireAdminApi()
  if (isAdminResponse(guard)) return guard.response
  const {actx} = guard

  const need = (p: Parameters<typeof requireAdminApi>[0]) => requireAdminApi(p)
  switch (scope) {
    case 'overview': {
      const g = await need('overview.view')
      if (isAdminResponse(g)) return g.response
      const data = await queries.commandCentre(actx, period)
      return Response.json({ok: true, ...data})
    }
    case 'investors': {
      const g = await need(actx.can('investors.view.all') ? 'investors.view.all' : 'investors.view.assigned')
      if (isAdminResponse(g)) return g.response
      const rows = await queries.investorList(actx, {
        search: sp.get('q') ?? undefined,
        tier: sp.get('tier') ?? undefined,
        verification: sp.get('verification') ?? undefined,
        classification: sp.get('classification') ?? undefined,
        dormant: sp.get('dormant') === '1',
      })
      return Response.json({ok: true, investors: rows})
    }
    case 'investor': {
      const g = await need(actx.can('investors.view.all') ? 'investors.view.all' : 'investors.view.assigned')
      if (isAdminResponse(g)) return g.response
      const id = sp.get('id') ?? ''
      const detail = await queries.investorDetail(actx, id)
      if (!detail) return fail('Investor not found.', 404)
      return Response.json({ok: true, ...detail})
    }
    case 'organisations': {
      const g = await need('organisations.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, organisations: await queries.organisationList()})
    }
    case 'opportunities': {
      const g = await need('opportunities.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, ...(await queries.opportunityInventory())})
    }
    case 'orders': {
      const g = await need(actx.can('orders.view.all') ? 'orders.view.all' : 'orders.view.assigned')
      if (isAdminResponse(g)) return g.response
      const orders = await queries.orderList(actx, {
        status: sp.get('status') ?? undefined,
        search: sp.get('q') ?? undefined,
        priority: sp.get('priority') ?? undefined,
        assignedTo: sp.get('assignedTo') ?? undefined,
      })
      return Response.json({ok: true, orders})
    }
    case 'order': {
      const g = await need(actx.can('orders.view.all') ? 'orders.view.all' : 'orders.view.assigned')
      if (isAdminResponse(g)) return g.response
      const detail = await queries.orderDetail(actx, sp.get('id') ?? '')
      if (!detail) return fail('Order not found.', 404)
      return Response.json({ok: true, ...detail})
    }
    case 'mandates': {
      const g = await need('mandates.view')
      if (isAdminResponse(g)) return g.response
      const mandates = await queries.mandateList(actx, {
        status: sp.get('status') ?? undefined,
        stage: sp.get('stage') ?? undefined,
        search: sp.get('q') ?? undefined,
      })
      return Response.json({ok: true, mandates})
    }
    case 'documents': {
      const g = await need('documents.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, ...(await queries.documentsWorkspace())})
    }
    case 'communications': {
      const g = await need('communications.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, ...(await queries.communicationsData(actx, {status: sp.get('status') ?? undefined}))})
    }
    case 'compliance': {
      const g = await need('compliance.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, ...(await queries.complianceQueue())})
    }
    case 'intelligence': {
      const g = await need('intelligence.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, ...(await queries.intelligenceList())})
    }
    case 'analytics': {
      const g = await need('analytics.view')
      if (isAdminResponse(g)) return g.response
      const [exec, investors, opportunities, orders, mandates, ops, advisors] = await Promise.all([
        analytics.executiveSnapshot(period),
        analytics.investorAnalytics(period),
        analytics.opportunityAnalytics(period),
        analytics.orderAnalytics(period),
        analytics.mandateAnalytics(period),
        analytics.operationalHealth(period),
        analytics.advisorPerformance(period),
      ])
      return Response.json({ok: true, period: {label: period.label, key: period.key}, executive: exec, investors, opportunities, orders, mandates, ops, advisors})
    }
    case 'revenue': {
      const g = await need('revenue.view')
      if (isAdminResponse(g)) return g.response
      const [card, breakdowns, pipeline, units, cohorts, cash] = await Promise.all([
        revenueCardMetrics(period),
        revenueBreakdowns(period),
        pipelineRevenue(),
        unitEconomics(period),
        cohortRevenue(),
        cashVersusRecognised(period),
      ])
      return Response.json({ok: true, card, breakdowns, pipeline, units, cohorts, cash})
    }
    case 'settings': {
      const g = await need('settings.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, ...(await queries.settingsData())})
    }
    case 'sessions': {
      const g = await need('security.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, ...(await queries.sessionsOverview())})
    }
    case 'audit': {
      const g = await need('audit.view')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, logs: await queries.auditViewer({
        actorId: sp.get('actorId') ?? undefined,
        entity: sp.get('entity') ?? undefined,
        action: sp.get('action') ?? undefined,
        search: sp.get('q') ?? undefined,
      })})
    }
    case 'staff': {
      const g = await need('staff.manage')
      if (isAdminResponse(g)) return g.response
      return Response.json({ok: true, staff: await queries.staffList()})
    }
    default:
      return fail('Unknown scope.')
  }
}
