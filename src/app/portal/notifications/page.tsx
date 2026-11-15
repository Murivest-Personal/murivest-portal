import type {Metadata} from 'next'
import {requirePortalUser} from '@/lib/auth/context'
import NotificationSettings from '@/components/portal/notifications/NotificationSettings'

export const metadata: Metadata = {
  title: 'Notification Settings',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

/**
 * Profile & Preferences → Notifications. Also the deep-link target of the
 * "Manage your notification preferences" link in every transactional email
 * footer — unauthenticated visitors are redirected to sign in and returned
 * here by the middleware.
 */
export default async function NotificationSettingsPage() {
  const ctx = await requirePortalUser()

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Profile &amp; preferences</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Notifications</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Choose precisely which signals reach you, and on which channel — in-app, this device via push, and email. Account &amp; security alerts are kept on by default; lower-priority categories can be folded into a single digest.
        </p>
      </div>
      <NotificationSettings email={ctx.user.email} />
    </div>
  )
}
