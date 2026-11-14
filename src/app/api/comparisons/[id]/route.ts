import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {fail, clientMeta} from '@/lib/api'

type Params = {params: Promise<{id: string}>}

/** DELETE — remove a saved comparison. */
export async function DELETE(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = await db.comparison.findFirst({where: {id, userId: guard.ctx.user.id}})
  if (!existing) return fail('Comparison not found.', 404)
  await db.comparison.delete({where: {id}})
  await audit({actorId: guard.ctx.user.id, action: 'comparison.deleted', entity: 'comparison', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
