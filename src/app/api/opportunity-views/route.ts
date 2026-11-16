import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, nowIso, newId} from '@/lib/supabase'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody} from '@/lib/api'

const viewSchema = z.object({sanityId: z.string().min(1).max(64)})

/** POST — record an authorised investor's view of an opportunity
 *  (feeds the "high-interest" signal in Discover). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, viewSchema)
  if ('response' in parsed) return parsed.response
  unwrap<null>(
    await supabase.from('opportunity_views').insert({
      id: newId(),
      user_id: guard.ctx.user.id,
      sanity_id: parsed.data.sanityId,
      viewed_at: nowIso(),
    }),
    'opportunityViews.create',
  )
  return NextResponse.json({ok: true})
}
