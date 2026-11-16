import {requireAdminPage} from '@/lib/admin/rbac'
import NotificationsWorkspace from '@/components/admin/NotificationsWorkspace'

export const dynamic = 'force-dynamic'

/**
 * Admin Notification Operations — ledger, announcements, templates.
 * Entry requires notifications.view; mutations are additionally gated by
 * notifications.manage / broadcast.send inside the API and the workspace UI.
 */
export default async function AdminNotificationsPage() {
  const actx = await requireAdminPage()
  if (!actx.can('notifications.view')) {
    // The nav hides this module for roles without the permission; a direct
    // URL still needs a hard gate.
    return (
      <div className="border border-border bg-card px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Permission denied — notifications.view</p>
      </div>
    )
  }

  return (
    <NotificationsWorkspace
      canManage={actx.can('notifications.manage')}
      canBroadcast={actx.can('broadcast.send')}
    />
  )
}
