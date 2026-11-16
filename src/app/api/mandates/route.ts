import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, toCamel, toCamelList, nowIso, newId} from '@/lib/supabase'
import {mandateSchema} from '@/lib/validation'
import {audit, notify, makeReference} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'
import type {MandateMilestone, MandateMilestoneRow, MandateRow} from '@/lib/db-types'

/** GET — investor's mandates with milestones. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response

  const mandateRows = unwrap<MandateRow[]>(
    await supabase
      .from('mandates')
      .select('*')
      .eq('user_id', guard.ctx.user.id)
      .order('created_at', {ascending: false}),
    'mandates.list',
  )
  // NOTE: Prisma `include: {milestones}` → separate query + JS join (no PostgREST embeds).
  const milestoneRows = mandateRows.length
    ? unwrap<MandateMilestoneRow[]>(
        await supabase
          .from('mandate_milestones')
          .select('*')
          .in('mandate_id', mandateRows.map((m) => m.id))
          .order('created_at', {ascending: true}),
        'mandates.milestones',
      )
    : []
  const milestonesByMandate = new Map<string, MandateMilestone[]>()
  for (const row of milestoneRows) {
    const milestone = toCamel(row)
    const list = milestonesByMandate.get(row.mandate_id)
    if (list) list.push(milestone)
    else milestonesByMandate.set(row.mandate_id, [milestone])
  }

  const mandates = toCamelList(mandateRows).map((m) => ({...m, milestones: milestonesByMandate.get(m.id) ?? []}))
  return NextResponse.json({ok: true, mandates})
}

/** POST — create a mandate (draft or submitted for Murivest review). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, mandateSchema.extend({submit: z.boolean().optional()}))
  if ('response' in parsed) return parsed.response
  const m = parsed.data

  const mandateRow = unwrap<MandateRow>(
    await supabase
      .from('mandates')
      .insert({
        id: newId(),
        reference: makeReference('MND'),
        user_id: ctx.user.id,
        title: m.title,
        description: m.description ?? null,
        target_allocation_min: m.targetAllocationMin ?? null,
        target_allocation_max: m.targetAllocationMax ?? null,
        currency: m.currency,
        geographies: m.geographies ?? null,
        asset_classes: m.assetClasses ?? null,
        structures: m.structures ?? null,
        min_net_yield: m.minNetYield ?? null,
        target_irr: m.targetIrr ?? null,
        hold_period_min: m.holdPeriodMin ?? null,
        hold_period_max: m.holdPeriodMax ?? null,
        leverage_comfort: m.leverageComfort ?? null,
        risk_mandate: m.riskMandate ?? null,
        exclusions: m.exclusions ?? null,
        status: m.submit ? 'submitted' : 'draft',
        ...(m.submit ? {submitted_at: nowIso()} : {}),
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('*')
      .single(),
    'mandates.create',
  )
  const mandate = toCamel(mandateRow)

  if (m.submit) {
    await notify({
      userId: ctx.user.id,
      type: 'mandate',
      title: 'Mandate submitted',
      body: `Mandate ${mandate.reference} is with our investment team. Your advisor will confirm scope and begin sourcing.`,
      link: '/portal/mandates',
    })
  }
  await audit({actorId: ctx.user.id, action: 'mandate.created', entity: 'mandate', entityId: mandate.id, detail: {reference: mandate.reference}, ...clientMeta(req)})
  return NextResponse.json({ok: true, mandate})
}
