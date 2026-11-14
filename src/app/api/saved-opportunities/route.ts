import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody} from '@/lib/api'

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

  const existing = await db.savedOpportunity.findUnique({
    where: {userId_sanityId: {userId: guard.ctx.user.id, sanityId}},
  })
  if (existing) {
    await db.savedOpportunity.delete({where: {id: existing.id}})
    return NextResponse.json({ok: true, saved: false})
  }
  await db.savedOpportunity.create({data: {userId: guard.ctx.user.id, sanityId, note: note ?? null}})
  return NextResponse.json({ok: true, saved: true})
}
