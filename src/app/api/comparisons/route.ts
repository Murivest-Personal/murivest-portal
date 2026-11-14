import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'

const comparisonSchema = z.object({
  name: z.string().trim().min(1).max(140),
  sanityIds: z.array(z.string().max(64)).max(6),
  scenarioIds: z.array(z.string().max(64)).max(6).optional(),
  snapshot: z.record(z.string(), z.unknown()).optional(),
})

/** GET — saved comparisons. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const comparisons = await db.comparison.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {updatedAt: 'desc'},
  })
  return NextResponse.json({ok: true, comparisons})
}

/** POST — save a comparison workspace for later review. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, comparisonSchema)
  if ('response' in parsed) return parsed.response
  const {name, sanityIds, scenarioIds, snapshot} = parsed.data

  const comparison = await db.comparison.create({
    data: {
      userId: guard.ctx.user.id,
      name,
      sanityIds: sanityIds as never,
      scenarioIds: (scenarioIds ?? []) as never,
      ...(snapshot ? {snapshot: snapshot as never} : {}),
    },
  })
  await audit({actorId: guard.ctx.user.id, action: 'comparison.created', entity: 'comparison', entityId: comparison.id, ...clientMeta(req)})
  return NextResponse.json({ok: true, comparison})
}
