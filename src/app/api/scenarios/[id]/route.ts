import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {scenarioSchema} from '@/lib/validation'
import {computeScenario} from '@/lib/finance/engine'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'

type Params = {params: Promise<{id: string}>}

/** PATCH — update a saved scenario (recomputes the metrics snapshot). */
export async function PATCH(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = await db.scenario.findFirst({where: {id, userId: guard.ctx.user.id}})
  if (!existing) return fail('Scenario not found.', 404)

  const parsed = await parseBody(req, scenarioSchema.partial())
  if ('response' in parsed) return parsed.response
  const input = parsed.data

  const inputs = input.inputs ?? (existing.inputs as never)
  const summary = input.inputs ? computeScenario(inputs) : undefined

  const scenario = await db.scenario.update({
    where: {id},
    data: {
      ...(input.name ? {name: input.name} : {}),
      ...(input.sanityOpportunityId !== undefined ? {sanityOpportunityId: input.sanityOpportunityId} : {}),
      ...(input.opportunityTitle !== undefined ? {opportunityTitle: input.opportunityTitle} : {}),
      ...(input.inputs ? {inputs: inputs as never} : {}),
      ...(summary ? {summary: summary as never} : {}),
      ...(input.notes !== undefined ? {notes: input.notes} : {}),
    },
  })
  await audit({actorId: guard.ctx.user.id, action: 'scenario.updated', entity: 'scenario', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true, scenario})
}

/** DELETE — remove a saved scenario. */
export async function DELETE(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = await db.scenario.findFirst({where: {id, userId: guard.ctx.user.id}})
  if (!existing) return fail('Scenario not found.', 404)
  await db.scenario.delete({where: {id}})
  await audit({actorId: guard.ctx.user.id, action: 'scenario.deleted', entity: 'scenario', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
