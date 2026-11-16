import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, toCamel} from '@/lib/supabase'
import {scenarioSchema} from '@/lib/validation'
import {computeScenario} from '@/lib/finance/engine'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {ScenarioRow} from '@/lib/db-types'

type Params = {params: Promise<{id: string}>}

/** PATCH — update a saved scenario (recomputes the metrics snapshot). */
export async function PATCH(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existingRow = unwrapNullable<ScenarioRow>(
    await supabase.from('scenarios').select('*').eq('id', id).eq('user_id', guard.ctx.user.id).maybeSingle(),
    'scenarios.get',
  )
  if (!existingRow) return fail('Scenario not found.', 404)
  const existing = toCamel(existingRow)

  const parsed = await parseBody(req, scenarioSchema.partial())
  if ('response' in parsed) return parsed.response
  const input = parsed.data

  const inputs = input.inputs ?? (existing.inputs as never)
  const summary = input.inputs ? computeScenario(inputs) : undefined

  const data: Record<string, unknown> = {
    ...(input.name ? {name: input.name} : {}),
    ...(input.sanityOpportunityId !== undefined ? {sanity_opportunity_id: input.sanityOpportunityId} : {}),
    ...(input.opportunityTitle !== undefined ? {opportunity_title: input.opportunityTitle} : {}),
    ...(input.inputs ? {inputs: inputs as never} : {}),
    ...(summary ? {summary: summary as never} : {}),
    ...(input.notes !== undefined ? {notes: input.notes} : {}),
  }

  // NOTE: PostgREST cannot PATCH an empty payload — a no-field PATCH reads the
  // row instead (Prisma tolerated an empty UPDATE). updated_at is maintained
  // by a DB trigger on real updates.
  const scenarioRow = Object.keys(data).length
    ? unwrap<ScenarioRow>(
        await supabase.from('scenarios').update(data).eq('id', id).select('*').single(),
        'scenarios.update',
      )
    : unwrap<ScenarioRow>(
        await supabase.from('scenarios').select('*').eq('id', id).single(),
        'scenarios.get',
      )
  await audit({actorId: guard.ctx.user.id, action: 'scenario.updated', entity: 'scenario', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true, scenario: toCamel(scenarioRow)})
}

/** DELETE — remove a saved scenario. */
export async function DELETE(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = unwrapNullable<ScenarioRow>(
    await supabase.from('scenarios').select('id').eq('id', id).eq('user_id', guard.ctx.user.id).maybeSingle(),
    'scenarios.get',
  )
  if (!existing) return fail('Scenario not found.', 404)
  unwrap(
    await supabase.from('scenarios').delete().eq('id', id),
    'scenarios.delete',
  )
  await audit({actorId: guard.ctx.user.id, action: 'scenario.deleted', entity: 'scenario', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
