import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, toCamel, nowIso} from '@/lib/supabase'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {CapitalCallRow, PortfolioPositionRow} from '@/lib/db-types'

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
  const callRow = unwrapNullable<CapitalCallRow>(
    await supabase.from('capital_calls').select('*').eq('id', id).maybeSingle(),
    'capitalCalls.get',
  )
  // Former Prisma `include: {position: true}` → follow-up query + ownership check.
  const positionRow = callRow
    ? unwrapNullable<PortfolioPositionRow>(
        await supabase.from('portfolio_positions').select('*').eq('id', callRow.position_id).maybeSingle(),
        'capitalCalls.position',
      )
    : null
  if (!callRow || !positionRow || (positionRow.user_id !== guard.ctx.user.id && !guard.ctx.isStaff)) {
    return fail('Capital call not found.', 404)
  }

  const parsed = await parseBody(req, patchSchema)
  if ('response' in parsed) return parsed.response
  const p = parsed.data

  const data: Record<string, unknown> = {
    ...(p.status
      ? {
          status: p.status,
          called_at: p.status === 'called' ? nowIso() : callRow.called_at,
          paid_at: p.status === 'paid' ? nowIso() : callRow.paid_at,
        }
      : {}),
    ...(p.label ? {label: p.label} : {}),
    ...(p.amount !== undefined ? {amount: p.amount} : {}),
    ...(p.dueDate !== undefined ? {due_date: p.dueDate ? new Date(p.dueDate).toISOString() : null} : {}),
    ...(p.notes !== undefined ? {notes: p.notes} : {}),
  }
  const updatedRow = unwrap<CapitalCallRow>(
    await supabase
      .from('capital_calls')
      .update(data)
      .eq('id', id)
      .select('*')
      .single(),
    'capitalCalls.update',
  )
  await audit({actorId: guard.ctx.user.id, action: 'capital_call.updated', entity: 'capital_call', entityId: id, detail: {status: p.status}, ...clientMeta(req)})
  return NextResponse.json({ok: true, call: toCamel(updatedRow)})
}
