import {requireAdminPage} from '@/lib/admin/rbac'
import {complianceQueue} from '@/lib/admin/queries'
import ComplianceWorkspace from '@/components/admin/ComplianceWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminCompliancePage() {
  const actx = await requireAdminPage()
  const data = await complianceQueue()

  return (
    <div>
      <PageHeader
        eyebrow="Fiduciary standard"
        title="Verification & Compliance"
        description="KYC/AML queue, document review, NDA acceptance tracking and tier progression — Registered → Verified → Full Access — with risk flags and full decision history."
      />
      <ComplianceWorkspace
        data={{
          pending: data.pending.map((p) => ({...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString()})),
          ndaGaps: data.ndaGaps,
          docRequests: data.docRequests.map((r) => ({...r, createdAt: r.createdAt.toISOString()})),
          flagged: data.flagged,
          reviews: data.reviews.map((r) => ({...r, createdAt: r.createdAt.toISOString()})),
          can: {review: actx.can('compliance.review'), manage: actx.can('investors.manage')},
        }}
      />
    </div>
  )
}
