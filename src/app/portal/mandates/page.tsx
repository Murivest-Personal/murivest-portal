import type {Metadata} from 'next'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {MandateMilestoneRow, MandateRow as MandateDbRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import MandatesWorkspace, {type MandateRow} from '@/components/portal/mandates/MandatesWorkspace'

export const metadata: Metadata = {
  title: 'Mandates',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function MandatesPage() {
  const ctx = await requirePortalUser()
  const mandates = toCamelList(
    unwrap<MandateDbRow[]>(
      await supabase.from('mandates').select('*').eq('user_id', ctx.user.id).order('created_at', {ascending: false}),
      'mandates.list',
    ),
  )

  // relation include (milestones) → separate query + JS join
  const mandateIds = mandates.map((m) => m.id)
  const milestoneRows = mandateIds.length
    ? toCamelList(
        unwrap<MandateMilestoneRow[]>(
          await supabase.from('mandate_milestones').select('*').in('mandate_id', mandateIds).order('created_at', {ascending: true}),
          'mandateMilestones.list',
        ),
      )
    : []
  const milestonesBy = new Map<string, typeof milestoneRows>()
  for (const ms of milestoneRows) {
    const arr = milestonesBy.get(ms.mandateId) ?? []
    arr.push(ms)
    milestonesBy.set(ms.mandateId, arr)
  }

  const rows: MandateRow[] = mandates.map((m) => ({
    id: m.id,
    reference: m.reference,
    title: m.title,
    status: m.status,
    description: m.description,
    targetAllocationMin: m.targetAllocationMin,
    targetAllocationMax: m.targetAllocationMax,
    currency: m.currency,
    geographies: (m.geographies as MandateRow['geographies']) ?? null,
    assetClasses: (m.assetClasses as string[]) ?? null,
    structures: (m.structures as string[]) ?? null,
    minNetYield: m.minNetYield,
    targetIrr: m.targetIrr,
    holdPeriodMin: m.holdPeriodMin,
    holdPeriodMax: m.holdPeriodMax,
    leverageComfort: m.leverageComfort,
    riskMandate: m.riskMandate,
    exclusions: (m.exclusions as string[]) ?? null,
    submittedAt: m.submittedAt ?? null,
    activatedAt: m.activatedAt ?? null,
    closedAt: m.closedAt ?? null,
    createdAt: m.createdAt,
    milestones: (milestonesBy.get(m.id) ?? []).map((ms) => ({
      id: ms.id,
      title: ms.title,
      detail: ms.detail,
      dueDate: ms.dueDate ?? null,
      status: ms.status,
      completedAt: ms.completedAt ?? null,
    })),
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Sourcing on your behalf</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Mandates</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Formal acquisition mandates — criteria, size, markets, structures and return targets — with status tracking, milestone delivery by your advisor, and Discover tagging of matching opportunities. Institutional users maintain multiple mandates in parallel.
        </p>
      </div>
      <MandatesWorkspace mandates={rows} />
    </div>
  )
}
