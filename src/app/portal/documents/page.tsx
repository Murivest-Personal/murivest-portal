import type {Metadata} from 'next'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {DocumentRequestRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import {getDocuments} from '@/lib/sanity/queries'
import {isSanityConfigured} from '@/lib/sanity/client'
import DocumentsWorkspace from '@/components/portal/documents/DocumentsWorkspace'

export const metadata: Metadata = {
  title: 'Documents — secure data room',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalUser()
  const sp = await searchParams
  const openNda = sp.nda === '1'

  const [documents, requests] = await Promise.all([
    getDocuments(ctx.effectiveTier),
    supabase
      .from('document_requests')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', {ascending: false})
      .limit(20)
      .then((res) => toCamelList(unwrap<DocumentRequestRow[]>(res, 'documentRequests.list'))),
  ])

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Secure data room</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Documents</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Investment memoranda, due-diligence packs, financial models, legal documents and transaction files — tier-gated, granted individually where required, streamed through an audited route. Direct asset URLs never reach the browser, and every view and download is logged.
        </p>
      </div>
      <DocumentsWorkspace
        documents={documents.map((d) => ({
          id: d._id,
          title: d.title,
          docType: d.docType,
          accessTier: d.accessTier,
          description: d.description ?? null,
          downloadable: !!d.downloadable,
          fileExtension: d.fileExtension ?? null,
          fileSize: d.fileSize ?? null,
          publishDate: d.publishDate ?? null,
          linkedOpportunityId: d.linkedOpportunityId ?? null,
        }))}
        requests={requests.map((r) => ({
          id: r.id,
          subject: r.subject,
          detail: r.detail,
          type: r.type,
          status: r.status,
          createdAt: r.createdAt,
        }))}
        ndaAccepted={!!ctx.profile?.ndaAccepted}
        openNda={openNda}
        sanityConfigured={isSanityConfigured()}
      />
    </div>
  )
}
