import type {Metadata} from 'next'
import {db} from '@/lib/db'
import {requirePortalUser} from '@/lib/auth/context'
import MandatesWorkspace, {type MandateRow} from '@/components/portal/mandates/MandatesWorkspace'

export const metadata: Metadata = {
  title: 'Mandates',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function MandatesPage() {
  const ctx = await requirePortalUser()
  const mandates = await db.mandate.findMany({
    where: {userId: ctx.user.id},
    orderBy: {createdAt: 'desc'},
    include: {milestones: {orderBy: {createdAt: 'asc'}}},
  })

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
    submittedAt: m.submittedAt?.toISOString() ?? null,
    activatedAt: m.activatedAt?.toISOString() ?? null,
    closedAt: m.closedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    milestones: m.milestones.map((ms) => ({
      id: ms.id,
      title: ms.title,
      detail: ms.detail,
      dueDate: ms.dueDate?.toISOString() ?? null,
      status: ms.status,
      completedAt: ms.completedAt?.toISOString() ?? null,
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
