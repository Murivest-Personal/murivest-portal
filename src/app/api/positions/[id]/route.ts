import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {positionSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'

type Params = {params: Promise<{id: string}>}

/** PATCH — update a position's actuals. */
export async function PATCH(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = await db.portfolioPosition.findFirst({where: {id, userId: guard.ctx.user.id}})
  if (!existing) return fail('Position not found.', 404)

  const parsed = await parseBody(req, positionSchema.partial())
  if ('response' in parsed) return parsed.response
  const p = parsed.data

  const position = await db.portfolioPosition.update({
    where: {id},
    data: {
      ...(p.name ? {name: p.name} : {}),
      ...(p.assetClass !== undefined ? {assetClass: p.assetClass} : {}),
      ...(p.geography !== undefined ? {geography: p.geography} : {}),
      ...(p.status ? {status: p.status} : {}),
      ...(p.acquisitionDate !== undefined ? {acquisitionDate: p.acquisitionDate ? new Date(p.acquisitionDate) : null} : {}),
      ...(p.purchasePrice !== undefined ? {purchasePrice: p.purchasePrice} : {}),
      ...(p.currency ? {currency: p.currency} : {}),
      ...(p.equityDeployed !== undefined ? {equityDeployed: p.equityDeployed} : {}),
      ...(p.debtAmount !== undefined ? {debtAmount: p.debtAmount} : {}),
      ...(p.debtRate !== undefined ? {debtRate: p.debtRate} : {}),
      ...(p.debtMaturity !== undefined ? {debtMaturity: p.debtMaturity ? new Date(p.debtMaturity) : null} : {}),
      ...(p.grossIncomeAnnual !== undefined ? {grossIncomeAnnual: p.grossIncomeAnnual} : {}),
      ...(p.operatingExpenses !== undefined ? {operatingExpenses: p.operatingExpenses} : {}),
      ...(p.noiActual !== undefined ? {noiActual: p.noiActual} : {}),
      ...(p.occupancyPct !== undefined ? {occupancyPct: p.occupancyPct} : {}),
      ...(p.valuation !== undefined ? {valuation: p.valuation} : {}),
      ...(p.valuationDate !== undefined ? {valuationDate: p.valuationDate ? new Date(p.valuationDate) : null} : {}),
      ...(p.valuationBasis !== undefined ? {valuationBasis: p.valuationBasis} : {}),
      ...(p.notes !== undefined ? {notes: p.notes} : {}),
    },
  })
  await audit({actorId: guard.ctx.user.id, action: 'position.updated', entity: 'position', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true, position})
}

/** DELETE — remove a position record. */
export async function DELETE(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = await db.portfolioPosition.findFirst({where: {id, userId: guard.ctx.user.id}})
  if (!existing) return fail('Position not found.', 404)
  await db.portfolioPosition.delete({where: {id}})
  await audit({actorId: guard.ctx.user.id, action: 'position.deleted', entity: 'position', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
