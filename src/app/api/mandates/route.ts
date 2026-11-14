import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {mandateSchema} from '@/lib/validation'
import {audit, notify, makeReference} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'

/** GET — investor's mandates with milestones. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const mandates = await db.mandate.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {createdAt: 'desc'},
    include: {milestones: {orderBy: {createdAt: 'asc'}}},
  })
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

  const mandate = await db.mandate.create({
    data: {
      reference: makeReference('MND'),
      userId: ctx.user.id,
      title: m.title,
      description: m.description ?? null,
      targetAllocationMin: m.targetAllocationMin ?? null,
      targetAllocationMax: m.targetAllocationMax ?? null,
      currency: m.currency,
      geographies: (m.geographies ?? undefined) as never,
      assetClasses: (m.assetClasses ?? undefined) as never,
      structures: (m.structures ?? undefined) as never,
      minNetYield: m.minNetYield ?? null,
      targetIrr: m.targetIrr ?? null,
      holdPeriodMin: m.holdPeriodMin ?? null,
      holdPeriodMax: m.holdPeriodMax ?? null,
      leverageComfort: m.leverageComfort ?? null,
      riskMandate: m.riskMandate ?? null,
      exclusions: (m.exclusions ?? undefined) as never,
      status: m.submit ? 'submitted' : 'draft',
      ...(m.submit ? {submittedAt: new Date()} : {}),
    },
  })

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
