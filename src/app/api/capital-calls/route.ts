import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {capitalCallSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'

/** POST — schedule a capital call against a position. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, capitalCallSchema)
  if ('response' in parsed) return parsed.response
  const c = parsed.data

  const position = await db.portfolioPosition.findFirst({where: {id: c.positionId, userId: ctx.user.id}})
  if (!position) return fail('Position not found.', 404)

  const call = await db.capitalCall.create({
    data: {
      positionId: c.positionId,
      label: c.label,
      amount: c.amount,
      currency: c.currency,
      dueDate: c.dueDate ? new Date(c.dueDate) : null,
      notes: c.notes ?? null,
    },
  })
  await audit({actorId: ctx.user.id, action: 'capital_call.created', entity: 'capital_call', entityId: call.id, ...clientMeta(req)})
  return NextResponse.json({ok: true, call})
}
