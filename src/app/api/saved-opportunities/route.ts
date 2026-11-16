import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, nowIso, newId} from '@/lib/supabase'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody} from '@/lib/api'
import type {SavedOpportunityRow} from '@/lib/db-types'

const toggleSchema = z.object({
  sanityId: z.string().min(1).max(64),
  note: z.string().max(500).optional(),
})

/** POST — toggle a saved opportunity (Discover "Save" action). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, toggleSchema)
  if ('response' in parsed) return parsed.response
  const {sanityId, note} = parsed.data

  const existing = unwrapNullable<SavedOpportunityRow>(
    await supabase
      .from('saved_opportunities')
      .select('id')
      .eq('user_id', guard.ctx.user.id)
      .eq('sanity_id', sanityId)
      .maybeSingle(),
    'savedOpportunities.get',
  )
  if (existing) {
    unwrap(
      await supabase.from('saved_opportunities').delete().eq('id', existing.id),
      'savedOpportunities.delete',
    )
    return NextResponse.json({ok: true, saved: false})
  }
  unwrap(
    await supabase
      .from('saved_opportunities')
      .insert({
        id: newId(),
        user_id: guard.ctx.user.id,
        sanity_id: sanityId,
        note: note ?? null,
        created_at: nowIso(),
      }),
    'savedOpportunities.create',
  )
  return NextResponse.json({ok: true, saved: true})
}
