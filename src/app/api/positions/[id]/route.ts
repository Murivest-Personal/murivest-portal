import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, toCamel} from '@/lib/supabase'
import {positionSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {PortfolioPositionRow} from '@/lib/db-types'

type Params = {params: Promise<{id: string}>}

/** PATCH — update a position's actuals. */
export async function PATCH(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = unwrapNullable<PortfolioPositionRow>(
    await supabase
      .from('portfolio_positions')
      .select('*')
      .eq('id', id)
      .eq('user_id', guard.ctx.user.id)
      .maybeSingle(),
    'positions.get',
  )
  if (!existing) return fail('Position not found.', 404)

  const parsed = await parseBody(req, positionSchema.partial())
  if ('response' in parsed) return parsed.response
  const p = parsed.data

  const data: Record<string, unknown> = {
    ...(p.name ? {name: p.name} : {}),
    ...(p.assetClass !== undefined ? {asset_class: p.assetClass} : {}),
    ...(p.geography !== undefined ? {geography: p.geography} : {}),
    ...(p.status ? {status: p.status} : {}),
    ...(p.acquisitionDate !== undefined ? {acquisition_date: p.acquisitionDate ? new Date(p.acquisitionDate).toISOString() : null} : {}),
    ...(p.purchasePrice !== undefined ? {purchase_price: p.purchasePrice} : {}),
    ...(p.currency ? {currency: p.currency} : {}),
    ...(p.equityDeployed !== undefined ? {equity_deployed: p.equityDeployed} : {}),
    ...(p.debtAmount !== undefined ? {debt_amount: p.debtAmount} : {}),
    ...(p.debtRate !== undefined ? {debt_rate: p.debtRate} : {}),
    ...(p.debtMaturity !== undefined ? {debt_maturity: p.debtMaturity ? new Date(p.debtMaturity).toISOString() : null} : {}),
    ...(p.grossIncomeAnnual !== undefined ? {gross_income_annual: p.grossIncomeAnnual} : {}),
    ...(p.operatingExpenses !== undefined ? {operating_expenses: p.operatingExpenses} : {}),
    ...(p.noiActual !== undefined ? {noi_actual: p.noiActual} : {}),
    ...(p.occupancyPct !== undefined ? {occupancy_pct: p.occupancyPct} : {}),
    ...(p.valuation !== undefined ? {valuation: p.valuation} : {}),
    ...(p.valuationDate !== undefined ? {valuation_date: p.valuationDate ? new Date(p.valuationDate).toISOString() : null} : {}),
    ...(p.valuationBasis !== undefined ? {valuation_basis: p.valuationBasis} : {}),
    ...(p.notes !== undefined ? {notes: p.notes} : {}),
  }
  // updated_at is maintained by the DB trigger — not set here.
  const positionRow = unwrap<PortfolioPositionRow>(
    await supabase
      .from('portfolio_positions')
      .update(data)
      .eq('id', id)
      .select('*')
      .single(),
    'positions.update',
  )
  await audit({actorId: guard.ctx.user.id, action: 'position.updated', entity: 'position', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true, position: toCamel(positionRow)})
}

/** DELETE — remove a position record. */
export async function DELETE(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = unwrapNullable<PortfolioPositionRow>(
    await supabase
      .from('portfolio_positions')
      .select('*')
      .eq('id', id)
      .eq('user_id', guard.ctx.user.id)
      .maybeSingle(),
    'positions.getForDelete',
  )
  if (!existing) return fail('Position not found.', 404)
  unwrap<null>(await supabase.from('portfolio_positions').delete().eq('id', id), 'positions.delete')
  await audit({actorId: guard.ctx.user.id, action: 'position.deleted', entity: 'position', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
