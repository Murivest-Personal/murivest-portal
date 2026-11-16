import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, toCamel, toCamelList, nowIso, newId} from '@/lib/supabase'
import {positionSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'
import type {PortfolioPositionRow, CapitalCallRow} from '@/lib/db-types'

/** GET — portfolio positions with capital calls. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const positionRows = unwrap<PortfolioPositionRow[]>(
    await supabase
      .from('portfolio_positions')
      .select('*')
      .eq('user_id', guard.ctx.user.id)
      .order('created_at', {ascending: false}),
    'positions.list',
  )
  // Former Prisma `include: {capitalCalls}` → follow-up query + JS join.
  const callsByPosition = new Map<string, CapitalCallRow[]>()
  if (positionRows.length > 0) {
    const callRows = unwrap<CapitalCallRow[]>(
      await supabase
        .from('capital_calls')
        .select('*')
        .in('position_id', positionRows.map((p) => p.id))
        .order('due_date', {ascending: true}),
      'capitalCalls.byPositions',
    )
    for (const row of callRows) {
      const bucket = callsByPosition.get(row.position_id)
      if (bucket) bucket.push(row)
      else callsByPosition.set(row.position_id, [row])
    }
  }
  const positions = positionRows.map((row) => ({
    ...toCamel(row),
    capitalCalls: toCamelList(callsByPosition.get(row.id) ?? []),
  }))
  return NextResponse.json({ok: true, positions})
}

/** POST — record an owned or committed position (actuals only). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, positionSchema)
  if ('response' in parsed) return parsed.response
  const p = parsed.data

  const positionRow = unwrap<PortfolioPositionRow>(
    await supabase
      .from('portfolio_positions')
      .insert({
        id: newId(),
        user_id: ctx.user.id,
        name: p.name,
        sanity_opportunity_id: p.sanityOpportunityId ?? null,
        asset_class: p.assetClass ?? null,
        geography: p.geography ?? null,
        status: p.status,
        acquisition_date: p.acquisitionDate ? new Date(p.acquisitionDate).toISOString() : null,
        purchase_price: p.purchasePrice ?? null,
        currency: p.currency,
        equity_deployed: p.equityDeployed ?? null,
        debt_amount: p.debtAmount ?? null,
        debt_rate: p.debtRate ?? null,
        debt_maturity: p.debtMaturity ? new Date(p.debtMaturity).toISOString() : null,
        gross_income_annual: p.grossIncomeAnnual ?? null,
        operating_expenses: p.operatingExpenses ?? null,
        noi_actual: p.noiActual ?? null,
        occupancy_pct: p.occupancyPct ?? null,
        valuation: p.valuation ?? null,
        valuation_date: p.valuationDate ? new Date(p.valuationDate).toISOString() : null,
        valuation_basis: p.valuationBasis ?? null,
        notes: p.notes ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('*')
      .single(),
    'positions.create',
  )
  await audit({actorId: ctx.user.id, action: 'position.created', entity: 'position', entityId: positionRow.id, detail: {name: p.name}, ...clientMeta(req)})
  return NextResponse.json({ok: true, position: toCamel(positionRow)})
}
