import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
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
  await db.opportunityView.create({data: {userId: guard.ctx.user.id, sanityId: parsed.data.sanityId}})
  return NextResponse.json({ok: true})
}
