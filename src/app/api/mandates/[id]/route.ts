import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {mandateSchema} from '@/lib/validation'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'

type Params = {params: Promise<{id: string}>}

/** PATCH — edit mandate criteria, or submit / pause / close it. */
export async function PATCH(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = await db.mandate.findFirst({where: {id, userId: guard.ctx.user.id}})
  if (!existing) return fail('Mandate not found.', 404)

  const parsed = await parseBody(
    req,
    mandateSchema.partial().extend({status: z.enum(['draft', 'submitted', 'paused', 'closed']).optional()}),
  )
  if ('response' in parsed) return parsed.response
  const m = parsed.data

  const statusTransition =
    m.status === 'submitted' ? {status: 'submitted', submittedAt: new Date()}
    : m.status === 'paused' ? {status: 'paused'}
    : m.status === 'closed' ? {status: 'closed', closedAt: new Date()}
    : {}

  const mandate = await db.mandate.update({
    where: {id},
    data: {
      ...(m.title ? {title: m.title} : {}),
      ...(m.description !== undefined ? {description: m.description} : {}),
      ...(m.targetAllocationMin !== undefined ? {targetAllocationMin: m.targetAllocationMin} : {}),
      ...(m.targetAllocationMax !== undefined ? {targetAllocationMax: m.targetAllocationMax} : {}),
      ...(m.currency ? {currency: m.currency} : {}),
      ...(m.geographies !== undefined ? {geographies: (m.geographies ?? undefined) as never} : {}),
      ...(m.assetClasses !== undefined ? {assetClasses: (m.assetClasses ?? undefined) as never} : {}),
      ...(m.structures !== undefined ? {structures: (m.structures ?? undefined) as never} : {}),
      ...(m.minNetYield !== undefined ? {minNetYield: m.minNetYield} : {}),
      ...(m.targetIrr !== undefined ? {targetIrr: m.targetIrr} : {}),
      ...(m.holdPeriodMin !== undefined ? {holdPeriodMin: m.holdPeriodMin} : {}),
      ...(m.holdPeriodMax !== undefined ? {holdPeriodMax: m.holdPeriodMax} : {}),
      ...(m.leverageComfort !== undefined ? {leverageComfort: m.leverageComfort} : {}),
      ...(m.riskMandate !== undefined ? {riskMandate: m.riskMandate} : {}),
      ...(m.exclusions !== undefined ? {exclusions: (m.exclusions ?? undefined) as never} : {}),
      ...statusTransition,
    },
  })

  if (m.status === 'submitted') {
    await notify({
      userId: guard.ctx.user.id,
      type: 'mandate',
      title: 'Mandate submitted',
      body: `Mandate ${mandate.reference} is with our investment team for confirmation.`,
      link: '/portal/mandates',
    })
  }
  await audit({actorId: guard.ctx.user.id, action: 'mandate.updated', entity: 'mandate', entityId: id, detail: {status: m.status}, ...clientMeta(req)})
  return NextResponse.json({ok: true, mandate})
}

/** DELETE — remove a draft mandate. */
export async function DELETE(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = await db.mandate.findFirst({where: {id, userId: guard.ctx.user.id, status: 'draft'}})
  if (!existing) return fail('Only draft mandates can be deleted.', 404)
  await db.mandate.delete({where: {id}})
  await audit({actorId: guard.ctx.user.id, action: 'mandate.deleted', entity: 'mandate', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
