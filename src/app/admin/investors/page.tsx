import {requireAdminPage} from '@/lib/admin/rbac'
import {investorList} from '@/lib/admin/queries'
import InvestorsWorkspace from '@/components/admin/InvestorsWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminInvestorsPage() {
  const actx = await requireAdminPage()
  const investors = await investorList(actx, {})

  return (
    <div>
      <PageHeader
        eyebrow="Relationship capital"
        title={actx.can('investors.view.all') ? 'Investors' : 'My Investors'}
        description={
          actx.can('investors.view.all')
            ? 'Complete investor profiles — individuals, UHNWIs and institutional representatives — with verification standing, stated capacity and full activity history.'
            : 'Investors assigned to you. Verification and tier changes are requested through Compliance.'
        }
      />
      <InvestorsWorkspace
        initial={investors.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
          lastLoginAt: i.lastLoginAt?.toISOString() ?? null,
        }))}
        canExport={actx.can('export.data')}
      />
    </div>
  )
}
