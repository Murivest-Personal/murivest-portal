import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, toCamel, nowIso, newId} from '@/lib/supabase'
import {capitalCallSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {CapitalCallRow, PortfolioPositionRow} from '@/lib/db-types'

/** POST — schedule a capital call against a position. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, capitalCallSchema)
  if ('response' in parsed) return parsed.response
  const c = parsed.data

  const position = unwrapNullable<PortfolioPositionRow>(
    await supabase
      .from('portfolio_positions')
      .select('*')
      .eq('id', c.positionId)
      .eq('user_id', ctx.user.id)
      .maybeSingle(),
    'capitalCalls.position',
  )
  if (!position) return fail('Position not found.', 404)

  const callRow = unwrap<CapitalCallRow>(
    await supabase
      .from('capital_calls')
      .insert({
        id: newId(),
        position_id: c.positionId,
        label: c.label,
        amount: c.amount,
        currency: c.currency,
        due_date: c.dueDate ? new Date(c.dueDate).toISOString() : null,
        notes: c.notes ?? null,
        created_at: nowIso(),
      })
      .select('*')
      .single(),
    'capitalCalls.create',
  )
  await audit({actorId: ctx.user.id, action: 'capital_call.created', entity: 'capital_call', entityId: callRow.id, ...clientMeta(req)})
  return NextResponse.json({ok: true, call: toCamel(callRow)})
}
