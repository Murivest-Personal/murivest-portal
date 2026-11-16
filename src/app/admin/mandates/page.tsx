import {requireAdminPage} from '@/lib/admin/rbac'
import {mandateList} from '@/lib/admin/queries'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {UserRow} from '@/lib/db-types'
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
    supabase
      .from('users')
      .select('id, full_name, email')
      .in('role', ['advisor', 'admin'])
      .eq('status', 'active')
      .order('full_name', {ascending: true})
      .then((res) =>
        toCamelList(unwrap<Pick<UserRow, 'id' | 'full_name' | 'email'>[]>(res, 'users.advisors')),
      ),
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
          milestones: m.milestones.map((ms) => ({id: ms.id, title: ms.title, status: ms.status, dueDate: ms.dueDate ?? null})),
          createdAt: m.createdAt,
          submittedAt: m.submittedAt ?? null,
          activatedAt: m.activatedAt ?? null,
          closedAt: m.closedAt ?? null,
          updatedAt: m.updatedAt,
          nextActionDue: m.nextActionDue ?? null,
        }))}
        initialStatus={status}
        canManage={actx.can('mandates.manage')}
        canExport={actx.can('export.data')}
        advisors={advisors.map((a) => ({id: a.id, name: a.fullName || a.email}))}
      />
    </div>
  )
}
