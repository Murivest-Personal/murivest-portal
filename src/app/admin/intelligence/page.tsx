import {requireAdminPage} from '@/lib/admin/rbac'
import {intelligenceList} from '@/lib/admin/queries'
import IntelligenceWorkspace from '@/components/admin/IntelligenceWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminIntelligencePage() {
  const actx = await requireAdminPage()
  const {rows, sanityConfigured, studioUrl} = await intelligenceList()

  return (
    <div>
      <PageHeader
        eyebrow="Content & research"
        title="Market Intelligence"
        description="Publish and manage research, reports, country insights and commentary — authored in Sanity, tiered visibility governed here."
      />
      <IntelligenceWorkspace rows={rows} sanityConfigured={sanityConfigured} studioUrl={studioUrl} canManage={actx.can('intelligence.manage')} />
    </div>
  )
}
