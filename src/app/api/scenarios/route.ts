import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {scenarioSchema} from '@/lib/validation'
import {computeScenario} from '@/lib/finance/engine'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'

/** GET — investor's saved scenarios (Studio continuity). */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const scenarios = await db.scenario.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {updatedAt: 'desc'},
  })
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
  const scenario = await db.scenario.create({
    data: {
      userId: ctx.user.id,
      name,
      sanityOpportunityId: sanityOpportunityId ?? null,
      opportunityTitle: opportunityTitle ?? null,
      inputs: inputs as never,
      summary: summary as never,
      notes: notes ?? null,
    },
  })
  await audit({actorId: ctx.user.id, action: 'scenario.created', entity: 'scenario', entityId: scenario.id, detail: {name}, ...clientMeta(req)})
  return NextResponse.json({ok: true, scenario})
}
