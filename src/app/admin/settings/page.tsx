import {requireAdminPage} from '@/lib/admin/rbac'
import {settingsData} from '@/lib/admin/queries'
import SettingsWorkspace from '@/components/admin/SettingsWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const actx = await requireAdminPage()
  const data = await settingsData()

  return (
    <div>
      <PageHeader
        eyebrow="System configuration"
        title="Settings & Security"
        description="Role and permission management, feature flags, integration status, the immutable audit log viewer and live session monitoring."
      />
      <SettingsWorkspace
        initial={{
          staff: data.staff.map((s) => ({...s, lastLoginAt: s.lastLoginAt ?? null})),
          settings: data.settings.map((s) => ({...s, updatedAt: s.updatedAt})),
          integrationStatus: data.integrationStatus,
          can: {
            manage: actx.can('settings.manage'),
            staff: actx.can('staff.manage'),
            audit: actx.can('audit.view'),
            security: actx.can('security.view'),
          },
        }}
      />
    </div>
  )
}
