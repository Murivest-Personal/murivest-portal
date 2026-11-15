import {notFound} from 'next/navigation'
import {requireAdminPage} from '@/lib/admin/rbac'
import {investorDetail} from '@/lib/admin/queries'
import {db} from '@/lib/db'
import InvestorDetailWorkspace from '@/components/admin/InvestorDetailWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminInvestorDetailPage({params}: {params: Promise<{id: string}>}) {
  const actx = await requireAdminPage()
  const {id} = await params
  const detail = await investorDetail(actx, id)
  if (!detail) notFound()

  const advisors = await db.user.findMany({
    where: {role: {in: ['advisor', 'admin']}, status: 'active'},
    select: {id: true, fullName: true, email: true, role: true},
    orderBy: {fullName: 'asc'},
  })

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
            lastLoginAt: detail.user.lastLoginAt?.toISOString() ?? null,
            createdAt: detail.user.createdAt.toISOString(),
            emailVerifiedAt: detail.user.emailVerifiedAt?.toISOString() ?? null,
            lockedUntil: detail.user.lockedUntil?.toISOString() ?? null,
            mfaEnabled: detail.user.mfaEnabled ? 'true' : 'false',
          },
          profile: {
            ...detail.profile,
            createdAt: detail.profile.createdAt.toISOString(),
            updatedAt: detail.profile.updatedAt.toISOString(),
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
            createdAt: o.createdAt.toISOString(),
            deliveredAt: o.deliveredAt?.toISOString() ?? null,
          })),
          mandates: detail.mandates.map((m) => ({...m, createdAt: m.createdAt.toISOString()})),
          grants: detail.grants.map((g) => ({
            ...g,
            expiresAt: g.expiresAt?.toISOString() ?? null,
            createdAt: g.createdAt.toISOString(),
          })),
          sessions: detail.sessions.map((s) => ({
            ...s,
            createdAt: s.createdAt.toISOString(),
            lastSeenAt: s.lastSeenAt.toISOString(),
            expiresAt: s.expiresAt.toISOString(),
            revokedAt: s.revokedAt?.toISOString() ?? null,
          })),
          securityEvents: detail.securityEvents.map((e) => ({...e, createdAt: e.createdAt.toISOString()})),
          notes: detail.notes.map((n) => ({...n, createdAt: n.createdAt.toISOString()})),
          reviews: detail.reviews.map((r) => ({...r, createdAt: r.createdAt.toISOString()})),
          criteria: detail.criteria ?? null,
          stats: detail.stats,
          auditTrail: detail.auditTrail.map((a) => ({...a, createdAt: a.createdAt.toISOString()})),
          advisors: advisors.map((a) => ({id: a.id, name: a.fullName || a.email, role: a.role})),
          can: {manage: actx.can('investors.manage'), compliance: actx.can('compliance.review')},
        }}
      />
    </div>
  )
}
