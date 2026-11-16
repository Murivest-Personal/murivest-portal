import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, toCamel, toCamelList, nowIso, newId} from '@/lib/supabase'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'
import type {ComparisonRow} from '@/lib/db-types'

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
  const comparisons = toCamelList(
    unwrap<ComparisonRow[]>(
      await supabase
        .from('comparisons')
        .select('*')
        .eq('user_id', guard.ctx.user.id)
        .order('updated_at', {ascending: false}),
      'comparisons.list',
    ),
  )
  return NextResponse.json({ok: true, comparisons})
}

/** POST — save a comparison workspace for later review. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, comparisonSchema)
  if ('response' in parsed) return parsed.response
  const {name, sanityIds, scenarioIds, snapshot} = parsed.data

  const comparisonRow = unwrap<ComparisonRow>(
    await supabase
      .from('comparisons')
      .insert({
          id: newId(),
          user_id: guard.ctx.user.id,
          name,
          sanity_ids: sanityIds,
          scenario_ids: scenarioIds ?? [],
          ...(snapshot ? {snapshot} : {}),
          created_at: nowIso(),
          updated_at: nowIso(),
        })
        .select('*')
        .single(),
    'comparisons.create',
  )
  const comparison = toCamel(comparisonRow)
  await audit({actorId: guard.ctx.user.id, action: 'comparison.created', entity: 'comparison', entityId: comparison.id, ...clientMeta(req)})
  return NextResponse.json({ok: true, comparison})
}
