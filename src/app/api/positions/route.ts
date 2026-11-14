import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {positionSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'

/** GET — portfolio positions with capital calls. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const positions = await db.portfolioPosition.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {createdAt: 'desc'},
    include: {capitalCalls: {orderBy: {dueDate: 'asc'}}},
  })
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

  const position = await db.portfolioPosition.create({
    data: {
      userId: ctx.user.id,
      name: p.name,
      sanityOpportunityId: p.sanityOpportunityId ?? null,
      assetClass: p.assetClass ?? null,
      geography: p.geography ?? null,
      status: p.status,
      acquisitionDate: p.acquisitionDate ? new Date(p.acquisitionDate) : null,
      purchasePrice: p.purchasePrice ?? null,
      currency: p.currency,
      equityDeployed: p.equityDeployed ?? null,
      debtAmount: p.debtAmount ?? null,
      debtRate: p.debtRate ?? null,
      debtMaturity: p.debtMaturity ? new Date(p.debtMaturity) : null,
      grossIncomeAnnual: p.grossIncomeAnnual ?? null,
      operatingExpenses: p.operatingExpenses ?? null,
      noiActual: p.noiActual ?? null,
      occupancyPct: p.occupancyPct ?? null,
      valuation: p.valuation ?? null,
      valuationDate: p.valuationDate ? new Date(p.valuationDate) : null,
      valuationBasis: p.valuationBasis ?? null,
      notes: p.notes ?? null,
    },
  })
  await audit({actorId: ctx.user.id, action: 'position.created', entity: 'position', entityId: position.id, detail: {name: p.name}, ...clientMeta(req)})
  return NextResponse.json({ok: true, position})
}
