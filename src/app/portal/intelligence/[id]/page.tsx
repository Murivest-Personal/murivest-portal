import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {ArrowLeft} from 'lucide-react'
import {requirePortalUser} from '@/lib/auth/context'
import {getMarketReportById} from '@/lib/sanity/queries'
import {fmtDate} from '@/lib/format'
import PortableBlocks from '@/components/portal/PortableBlocks'

export const metadata: Metadata = {
  title: 'Intelligence',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function IntelligenceArticlePage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const ctx = await requirePortalUser()
  const report = await getMarketReportById(decodeURIComponent(id), ctx.effectiveTier)
  if (!report) notFound()

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/portal/intelligence" className="mb-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-gold">
        <ArrowLeft className="h-3.5 w-3.5" /> Market Intelligence
      </Link>

      <header className="mb-8 border-b border-border pb-8">
        <div className="eyebrow mb-3">{report.geography || 'International'} · {report.publishDate ? fmtDate(report.publishDate) : ''}</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">{report.title}</h1>
        {report.summary ? <p className="mt-4 text-base leading-relaxed text-muted-foreground">{report.summary}</p> : null}
      </header>

      <PortableBlocks blocks={report.body} className="text-[15px] leading-7" />

      {report.attachedDocumentId ? (
        <a
          href={`/api/documents/${encodeURIComponent(report.attachedDocumentId)}/file`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-10 inline-flex items-center gap-2 border border-gold/60 bg-gold/10 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-primary hover:bg-gold/20"
        >
          Open attached document
        </a>
      ) : null}

      <p className="mt-12 border-t border-border pt-6 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Murivest desk research · permission-tier {report.accessTier.replace('_', ' ')} · strictly confidential
      </p>
    </article>
  )
}
