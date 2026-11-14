import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {criteriaSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'

/** Investment Criteria Workspace — one live criteria set per investor. */
export async function PUT(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, criteriaSchema)
  if ('response' in parsed) return parsed.response
  const c = parsed.data

  const data = {
    currency: c.currency,
    equityAvailable: c.equityAvailable ?? null,
    totalCapacity: c.totalCapacity ?? null,
    minTicket: c.minTicket ?? null,
    maxTicket: c.maxTicket ?? null,
    geographies: (c.geographies ?? undefined) as never,
    assetClasses: (c.assetClasses ?? undefined) as never,
    structures: (c.structures ?? undefined) as never,
    minGrossYield: c.minGrossYield ?? null,
    minNetYield: c.minNetYield ?? null,
    targetIrr: c.targetIrr ?? null,
    targetCashOnCash: c.targetCashOnCash ?? null,
    targetPaybackYears: c.targetPaybackYears ?? null,
    holdPeriodMin: c.holdPeriodMin ?? null,
    holdPeriodMax: c.holdPeriodMax ?? null,
    leverageComfort: c.leverageComfort ?? null,
    financingOpen: c.financingOpen ?? true,
    riskTolerance: c.riskTolerance ?? null,
    exitPreferences: (c.exitPreferences ?? undefined) as never,
  }

  const criteria = await db.investorCriteria.upsert({
    where: {userId: ctx.user.id},
    create: {userId: ctx.user.id, ...data},
    update: data,
  })

  await audit({actorId: ctx.user.id, action: 'criteria.updated', entity: 'criteria', entityId: criteria.id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
