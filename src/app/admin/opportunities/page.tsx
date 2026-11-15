import {requireAdminPage} from '@/lib/admin/rbac'
import {opportunityInventory} from '@/lib/admin/queries'
import OpportunitiesWorkspace from '@/components/admin/OpportunitiesWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminOpportunitiesPage() {
  const actx = await requireAdminPage()
  const {rows, sanityConfigured, studioUrl} = await opportunityInventory()

  return (
    <div>
      <PageHeader
        eyebrow="Inventory control"
        title="Opportunities"
        description="The full opportunity inventory with tiered visibility, auction links and demand analytics. Properties are authored in Sanity; visibility, curation and archival are governed here."
      />
      <OpportunitiesWorkspace
        rows={rows}
        sanityConfigured={sanityConfigured}
        studioUrl={studioUrl}
        canManage={actx.can('opportunities.manage')}
        canExport={actx.can('export.data')}
      />
    </div>
  )
}
