import {notFound} from 'next/navigation'
import {requireAdminPage} from '@/lib/admin/rbac'
import {investorDetail} from '@/lib/admin/queries'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {UserRow} from '@/lib/db-types'
import InvestorDetailWorkspace from '@/components/admin/InvestorDetailWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminInvestorDetailPage({params}: {params: Promise<{id: string}>}) {
  const actx = await requireAdminPage()
  const {id} = await params
  const detail = await investorDetail(actx, id)
  if (!detail) notFound()

  const advisors = toCamelList(
    unwrap<Pick<UserRow, 'id' | 'full_name' | 'email' | 'role'>[]>(
      await supabase
        .from('users')
        .select('id, full_name, email, role')
        .in('role', ['advisor', 'admin'])
        .eq('status', 'active')
        .order('full_name', {ascending: true}),
      'users.advisors',
    ),
  )

  return (
    <div>
      <PageHeader
        eyebrow="Investor record"
        title="Investor profile"
        description="Verification standing, capacity, relationships, orders, mandates and the full activity timeline — one confidential record."
      />
      <InvestorDetailWorkspace
        data={{
          user: {
            ...detail.user,
            lastLoginAt: detail.user.lastLoginAt ?? null,
            createdAt: detail.user.createdAt,
            emailVerifiedAt: detail.user.emailVerifiedAt ?? null,
            lockedUntil: detail.user.lockedUntil ?? null,
            mfaEnabled: detail.user.mfaEnabled ? 'true' : 'false',
          },
          profile: {
            ...detail.profile,
            createdAt: detail.profile.createdAt,
            updatedAt: detail.profile.updatedAt,
          },
          organisation: detail.organisation
            ? {
                ...detail.organisation,
                verified: detail.organisation.verified ? 'true' : 'false',
                members: detail.organisation.members.map((m) => ({name: m.user.fullName || m.user.email, email: m.user.email, role: m.role, status: m.status})),
              }
            : null,
          advisor: detail.advisor,
          orders: detail.orders.map((o) => ({
            ...o,
            createdAt: o.createdAt,
            deliveredAt: o.deliveredAt ?? null,
          })),
          mandates: detail.mandates.map((m) => ({...m, createdAt: m.createdAt})),
          grants: detail.grants.map((g) => ({
            ...g,
            expiresAt: g.expiresAt ?? null,
            createdAt: g.createdAt,
          })),
          sessions: detail.sessions.map((s) => ({
            ...s,
            createdAt: s.createdAt,
            lastSeenAt: s.lastSeenAt,
            expiresAt: s.expiresAt,
            revokedAt: s.revokedAt ?? null,
          })),
          securityEvents: detail.securityEvents.map((e) => ({...e, createdAt: e.createdAt})),
          notes: detail.notes.map((n) => ({...n, createdAt: n.createdAt})),
          reviews: detail.reviews.map((r) => ({...r, createdAt: r.createdAt})),
          criteria: detail.criteria ?? null,
          stats: detail.stats,
          auditTrail: detail.auditTrail.map((a) => ({...a, createdAt: a.createdAt})),
          advisors: advisors.map((a) => ({id: a.id, name: a.fullName || a.email, role: a.role})),
          can: {manage: actx.can('investors.manage'), compliance: actx.can('compliance.review')},
        }}
      />
    </div>
  )
}
