import {requireAdminPage} from '@/lib/admin/rbac'
import {mandateList} from '@/lib/admin/queries'
import {db} from '@/lib/db'
import MandatesWorkspace from '@/components/admin/MandatesWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminMandatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actx = await requireAdminPage()
  const sp = await searchParams
  const status = typeof sp.status === 'string' ? sp.status : ''

  const [mandates, advisors] = await Promise.all([
    mandateList(actx, status ? {status} : {}),
    db.user.findMany({where: {role: {in: ['advisor', 'admin']}, status: 'active'}, select: {id: true, fullName: true, email: true}, orderBy: {fullName: 'asc'}}),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Acquisition pipeline"
        title="Mandates"
        description="Every investor mandate with stage, win probability, advisor attribution and next actions — the weighted pipeline feeding the Revenue Card forecast."
      />
      <MandatesWorkspace
        initial={mandates.map((m) => ({
          ...m,
          milestones: m.milestones.map((ms) => ({id: ms.id, title: ms.title, status: ms.status, dueDate: ms.dueDate?.toISOString() ?? null})),
          createdAt: m.createdAt.toISOString(),
          submittedAt: m.submittedAt?.toISOString() ?? null,
          activatedAt: m.activatedAt?.toISOString() ?? null,
          closedAt: m.closedAt?.toISOString() ?? null,
          updatedAt: m.updatedAt.toISOString(),
          nextActionDue: m.nextActionDue?.toISOString() ?? null,
        }))}
        initialStatus={status}
        canManage={actx.can('mandates.manage')}
        canExport={actx.can('export.data')}
        advisors={advisors.map((a) => ({id: a.id, name: a.fullName || a.email}))}
      />
    </div>
  )
}
