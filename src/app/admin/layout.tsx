import type {Metadata} from 'next'
import {requireAdminPage, type Permission} from '@/lib/admin/rbac'
import AdminShell, {type AdminNavItem} from '@/components/admin/AdminShell'

export const metadata: Metadata = {
  title: 'Murivest Admin — Internal System',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

const NAV_DEFS: {href: string; label: string; icon: string; permission?: Permission}[] = [
  {href: '/admin', label: 'Command Centre', icon: 'command'},
  {href: '/admin/investors', label: 'Investors', icon: 'investors', permission: 'investors.view.all'},
  {href: '/admin/investors', label: 'My Investors', icon: 'investors', permission: 'investors.view.assigned'},
  {href: '/admin/organisations', label: 'Organisations', icon: 'organisations', permission: 'organisations.view'},
  {href: '/admin/opportunities', label: 'Opportunities', icon: 'opportunities', permission: 'opportunities.view'},
  {href: '/admin/orders', label: 'Orders Engine', icon: 'orders', permission: 'orders.view.all'},
  {href: '/admin/orders', label: 'Orders', icon: 'orders', permission: 'orders.view.assigned'},
  {href: '/admin/mandates', label: 'Mandates', icon: 'mandates', permission: 'mandates.view'},
  {href: '/admin/documents', label: 'Documents', icon: 'documents', permission: 'documents.view'},
  {href: '/admin/communications', label: 'Communications', icon: 'communications', permission: 'communications.view'},
  {href: '/admin/notifications', label: 'Notifications', icon: 'notifications', permission: 'notifications.view'},
  {href: '/admin/compliance', label: 'Compliance', icon: 'compliance', permission: 'compliance.view'},
  {href: '/admin/intelligence', label: 'Intelligence', icon: 'intelligence', permission: 'intelligence.view'},
  {href: '/admin/analytics', label: 'Analytics', icon: 'analytics', permission: 'analytics.view'},
  {href: '/admin/finance', label: 'Finance & Revenue', icon: 'finance', permission: 'revenue.view'},
  {href: '/admin/settings', label: 'Settings & Security', icon: 'settings', permission: 'settings.view'},
]

export default async function AdminLayout({children}: {children: React.ReactNode}) {
  const actx = await requireAdminPage()

  // Deduplicate nav by href (advisor sees "My Investors" instead of "Investors").
  const seen = new Set<string>()
  const nav: AdminNavItem[] = NAV_DEFS.filter((item) => {
    if (!item.permission || !actx.can(item.permission)) return false
    if (seen.has(item.href)) return false
    seen.add(item.href)
    return true
  }).map(({href, label, icon}) => ({href, label, icon}))

  return (
    <AdminShell
      userId={actx.auth.user.id}
      staffName={actx.auth.user.fullName || actx.auth.user.email}
      roleLabel={actx.role === 'super_admin' ? 'Super Administrator' : actx.role === 'ops_lead' ? 'Operations Lead' : actx.role === 'advisor' ? 'Advisor' : actx.role === 'compliance' ? 'Compliance / KYC' : actx.role === 'finance' ? 'Finance / Revenue' : actx.role === 'content' ? 'Content / Research' : 'Read-Only Analyst'}
      email={actx.auth.user.email}
      nav={nav}
    >
      {children}
    </AdminShell>
  )
}
