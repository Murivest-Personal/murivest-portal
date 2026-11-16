import {requireAdminPage} from '@/lib/admin/rbac'
import {documentsWorkspace, sanityStudioUrl} from '@/lib/admin/queries'
import DocumentsWorkspace from '@/components/admin/DocumentsWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminDocumentsPage() {
  const actx = await requireAdminPage()
  const data = await documentsWorkspace()

  return (
    <div>
      <PageHeader
        eyebrow="Secure data room"
        title="Documents"
        description="Permission control, expiring access, request fulfilment and a complete access log. Documents are uploaded in Sanity; access is governed here."
      />
      <DocumentsWorkspace
        data={{
          grants: data.grants.map((g) => ({...g, expiresAt: g.expiresAt ?? null, createdAt: g.createdAt})),
          requests: data.requests.map((r) => ({...r, createdAt: r.createdAt})),
          accessLogs: data.accessLogs.map((l) => ({...l, createdAt: l.createdAt})),
          metas: data.metas,
          sanityDocs: data.sanityDocs as never,
          sanityConfigured: data.sanityConfigured,
          studioUrl: sanityStudioUrl(),
          can: {manage: actx.can('documents.manage')},
        }}
      />
    </div>
  )
}
