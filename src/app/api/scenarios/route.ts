import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, toCamel, toCamelList, nowIso, newId} from '@/lib/supabase'
import {scenarioSchema} from '@/lib/validation'
import {computeScenario} from '@/lib/finance/engine'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'
import type {ScenarioRow} from '@/lib/db-types'

/** GET — investor's saved scenarios (Studio continuity). */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const scenarios = toCamelList(
    unwrap<ScenarioRow[]>(
      await supabase
        .from('scenarios')
        .select('*')
        .eq('user_id', guard.ctx.user.id)
        .order('updated_at', {ascending: false}),
      'scenarios.list',
    ),
  )
  return NextResponse.json({ok: true, scenarios})
}

/** POST — create a named scenario with its full transparent assumption set. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, scenarioSchema)
  if ('response' in parsed) return parsed.response
  const {name, sanityOpportunityId, opportunityTitle, inputs, notes} = parsed.data

  const summary = computeScenario(inputs)
  const scenarioRow = unwrap<ScenarioRow>(
    await supabase
      .from('scenarios')
      .insert({
        id: newId(),
        user_id: ctx.user.id,
        name,
        sanity_opportunity_id: sanityOpportunityId ?? null,
        opportunity_title: opportunityTitle ?? null,
        inputs,
        summary,
        notes: notes ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('*')
      .single(),
    'scenarios.create',
  )
  const scenario = toCamel(scenarioRow)
  await audit({actorId: ctx.user.id, action: 'scenario.created', entity: 'scenario', entityId: scenario.id, detail: {name}, ...clientMeta(req)})
  return NextResponse.json({ok: true, scenario})
}
