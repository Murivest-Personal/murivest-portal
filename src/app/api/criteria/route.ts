import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, toSnake, nowIso, newId} from '@/lib/supabase'
import {criteriaSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'
import type {InvestorCriteriaRow} from '@/lib/db-types'

/** Investment Criteria Workspace — one live criteria set per investor. */
export async function PUT(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, criteriaSchema)
  if ('response' in parsed) return parsed.response
  const c = parsed.data

  const data = {
    currency: c.currency,
    equityAvailable: c.equityAvailable ?? null,
    totalCapacity: c.totalCapacity ?? null,
    minTicket: c.minTicket ?? null,
    maxTicket: c.maxTicket ?? null,
    geographies: (c.geographies ?? undefined) as never,
    assetClasses: (c.assetClasses ?? undefined) as never,
    structures: (c.structures ?? undefined) as never,
    minGrossYield: c.minGrossYield ?? null,
    minNetYield: c.minNetYield ?? null,
    targetIrr: c.targetIrr ?? null,
    targetCashOnCash: c.targetCashOnCash ?? null,
    targetPaybackYears: c.targetPaybackYears ?? null,
    holdPeriodMin: c.holdPeriodMin ?? null,
    holdPeriodMax: c.holdPeriodMax ?? null,
    leverageComfort: c.leverageComfort ?? null,
    financingOpen: c.financingOpen ?? true,
    riskTolerance: c.riskTolerance ?? null,
    exitPreferences: (c.exitPreferences ?? undefined) as never,
  }

  // One live criteria set per investor (upsert keyed on the unique user_id).
  // Undefined keys are dropped in serialization, exactly like Prisma skipped
  // undefined fields on both the insert and the update branch.
  unwrap(
    await supabase
      .from('investor_criteria')
      .upsert([toSnake({id: newId(), userId: ctx.user.id, ...data, createdAt: nowIso(), updatedAt: nowIso()})], {
        onConflict: 'user_id',
      }),
    'criteria.upsert',
  )
  const criteriaRow = unwrap<InvestorCriteriaRow>(
    await supabase.from('investor_criteria').select('*').eq('user_id', ctx.user.id).single(),
    'criteria.get',
  )

  await audit({actorId: ctx.user.id, action: 'criteria.updated', entity: 'criteria', entityId: criteriaRow.id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}
