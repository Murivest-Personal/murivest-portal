import {requireAdminPage} from '@/lib/admin/rbac'
import {communicationsData} from '@/lib/admin/queries'
import CommunicationsWorkspace from '@/components/admin/CommunicationsWorkspace'
import {PageHeader} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminCommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const actx = await requireAdminPage()
  const sp = await searchParams
  const status = typeof sp.status === 'string' ? sp.status : ''

  const {threads} = await communicationsData(actx, status ? {status} : {})

  return (
    <div>
      <PageHeader
        eyebrow="High-touch relationships"
        title="Communications"
        description="Unified inbox of investor messages and enquiries with advisor assignment, secure replies and internal context."
      />
      <CommunicationsWorkspace
        initialThreads={threads.map((t) => ({
          ...t,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          lastActivityAt: t.lastActivityAt,
          messages: t.messages.map((m) => ({...m, createdAt: m.createdAt})),
        }))}
        canReply={actx.can('communications.reply')}
        initialStatus={status}
      />
    </div>
  )
}
