import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable} from '@/lib/supabase'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {fail, clientMeta} from '@/lib/api'
import type {ComparisonRow} from '@/lib/db-types'

type Params = {params: Promise<{id: string}>}

/** DELETE — remove a saved comparison. */
export async function DELETE(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = unwrapNullable<ComparisonRow>(
    await supabase.from('comparisons').select('id').eq('id', id).eq('user_id', guard.ctx.user.id).maybeSingle(),
    'comparisons.get',
  )
  if (!existing) return fail('Comparison not found.', 404)
  unwrap(
    await supabase.from('comparisons').delete().eq('id', id),
    'comparisons.delete',
  )
  await audit({actorId: guard.ctx.user.id, action: 'comparison.deleted', entity: 'comparison', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
