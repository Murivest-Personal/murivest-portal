import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {savedSearchSchema} from '@/lib/validation'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail} from '@/lib/api'

/** GET — investor's saved searches & alert rules. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const searches = await db.savedSearch.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {createdAt: 'desc'},
  })
  return NextResponse.json({ok: true, searches})
}

/** POST — save a Discover filter set, optionally with new-match alerts. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, savedSearchSchema)
  if ('response' in parsed) return parsed.response
  const search = await db.savedSearch.create({
    data: {
      userId: guard.ctx.user.id,
      name: parsed.data.name,
      filters: parsed.data.filters as never,
      alertOnNew: parsed.data.alertOnNew ?? false,
    },
  })
  return NextResponse.json({ok: true, search})
}

/** DELETE — remove a saved search. */
export async function DELETE(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return fail('Provide the search id.')
  const existing = await db.savedSearch.findFirst({where: {id, userId: guard.ctx.user.id}})
  if (!existing) return fail('Saved search not found.', 404)
  await db.savedSearch.delete({where: {id}})
  return NextResponse.json({ok: true})
}

export const dynamic = 'force-dynamic'
