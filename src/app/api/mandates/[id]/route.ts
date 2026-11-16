import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, toCamel, nowIso} from '@/lib/supabase'
import {mandateSchema} from '@/lib/validation'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {MandateRow} from '@/lib/db-types'

type Params = {params: Promise<{id: string}>}

/** PATCH — edit mandate criteria, or submit / pause / close it. */
export async function PATCH(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = unwrapNullable<MandateRow>(
    await supabase.from('mandates').select('id').eq('id', id).eq('user_id', guard.ctx.user.id).maybeSingle(),
    'mandates.get',
  )
  if (!existing) return fail('Mandate not found.', 404)

  const parsed = await parseBody(
    req,
    mandateSchema.partial().extend({status: z.enum(['draft', 'submitted', 'paused', 'closed']).optional()}),
  )
  if ('response' in parsed) return parsed.response
  const m = parsed.data

  const statusTransition: Record<string, unknown> =
    m.status === 'submitted' ? {status: 'submitted', submitted_at: nowIso()}
    : m.status === 'paused' ? {status: 'paused'}
    : m.status === 'closed' ? {status: 'closed', closed_at: nowIso()}
    : {}

  const data: Record<string, unknown> = {
    ...(m.title ? {title: m.title} : {}),
    ...(m.description !== undefined ? {description: m.description} : {}),
    ...(m.targetAllocationMin !== undefined ? {target_allocation_min: m.targetAllocationMin} : {}),
    ...(m.targetAllocationMax !== undefined ? {target_allocation_max: m.targetAllocationMax} : {}),
    ...(m.currency ? {currency: m.currency} : {}),
    ...(m.geographies !== undefined ? {geographies: (m.geographies ?? undefined) as never} : {}),
    ...(m.assetClasses !== undefined ? {asset_classes: (m.assetClasses ?? undefined) as never} : {}),
    ...(m.structures !== undefined ? {structures: (m.structures ?? undefined) as never} : {}),
    ...(m.minNetYield !== undefined ? {min_net_yield: m.minNetYield} : {}),
    ...(m.targetIrr !== undefined ? {target_irr: m.targetIrr} : {}),
    ...(m.holdPeriodMin !== undefined ? {hold_period_min: m.holdPeriodMin} : {}),
    ...(m.holdPeriodMax !== undefined ? {hold_period_max: m.holdPeriodMax} : {}),
    ...(m.leverageComfort !== undefined ? {leverage_comfort: m.leverageComfort} : {}),
    ...(m.riskMandate !== undefined ? {risk_mandate: m.riskMandate} : {}),
    ...(m.exclusions !== undefined ? {exclusions: (m.exclusions ?? undefined) as never} : {}),
    ...statusTransition,
  }

  // NOTE: PostgREST cannot PATCH an empty payload — a no-field PATCH reads the
  // row instead (Prisma tolerated an empty UPDATE). updated_at is maintained
  // by a DB trigger on real updates.
  const mandateRow = Object.keys(data).length
    ? unwrap<MandateRow>(
        await supabase.from('mandates').update(data).eq('id', id).select('*').single(),
        'mandates.update',
      )
    : unwrap<MandateRow>(
        await supabase.from('mandates').select('*').eq('id', id).single(),
        'mandates.get',
      )
  const mandate = toCamel(mandateRow)

  if (m.status === 'submitted') {
    await notify({
      userId: guard.ctx.user.id,
      type: 'mandate',
      title: 'Mandate submitted',
      body: `Mandate ${mandate.reference} is with our investment team for confirmation.`,
      link: '/portal/mandates',
    })
  }
  await audit({actorId: guard.ctx.user.id, action: 'mandate.updated', entity: 'mandate', entityId: id, detail: {status: m.status}, ...clientMeta(req)})
  return NextResponse.json({ok: true, mandate})
}

/** DELETE — remove a draft mandate. */
export async function DELETE(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {id} = await params
  const existing = unwrapNullable<MandateRow>(
    await supabase.from('mandates').select('id').eq('id', id).eq('user_id', guard.ctx.user.id).eq('status', 'draft').maybeSingle(),
    'mandates.getDraft',
  )
  if (!existing) return fail('Only draft mandates can be deleted.', 404)
  unwrap(
    await supabase.from('mandates').delete().eq('id', id),
    'mandates.delete',
  )
  await audit({actorId: guard.ctx.user.id, action: 'mandate.deleted', entity: 'mandate', entityId: id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
