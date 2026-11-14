import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'

type Params = {params: Promise<{id: string}>}

const patchSchema = z.object({
  status: z.enum(['scheduled', 'called', 'paid', 'waived']),
  label: z.string().trim().min(1).max(160).optional(),
  amount: z.number().min(0).max(1e12).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

/** PATCH — advance a capital call (called → paid) or edit it. */
export async function PATCH(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const call = await db.capitalCall.findFirst({
    where: {id},
    include: {position: true},
  })
  if (!call || (call.position.userId !== guard.ctx.user.id && !guard.ctx.isStaff)) {
    return fail('Capital call not found.', 404)
  }

  const parsed = await parseBody(req, patchSchema)
  if ('response' in parsed) return parsed.response
  const p = parsed.data

  const updated = await db.capitalCall.update({
    where: {id},
    data: {
      ...(p.status ? {status: p.status, calledAt: p.status === 'called' ? new Date() : call.calledAt, paidAt: p.status === 'paid' ? new Date() : call.paidAt} : {}),
      ...(p.label ? {label: p.label} : {}),
      ...(p.amount !== undefined ? {amount: p.amount} : {}),
      ...(p.dueDate !== undefined ? {dueDate: p.dueDate ? new Date(p.dueDate) : null} : {}),
      ...(p.notes !== undefined ? {notes: p.notes} : {}),
    },
  })
  await audit({actorId: guard.ctx.user.id, action: 'capital_call.updated', entity: 'capital_call', entityId: id, detail: {status: p.status}, ...clientMeta(req)})
  return NextResponse.json({ok: true, call: updated})
}
