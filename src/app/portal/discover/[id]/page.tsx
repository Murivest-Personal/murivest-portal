import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {supabase, unwrapNullable} from '@/lib/supabase'
import type {SavedOpportunityRow} from '@/lib/db-types'
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  Columns3,
  Eye,
  FileStack,
  Lock,
  MapPin,
  MessagesSquare,
  ShieldAlert,
} from 'lucide-react'
import {requirePortalUser} from '@/lib/auth/context'
import {getOpportunityById, getBriefs, getDocuments} from '@/lib/sanity/queries'
import {fmtMoney, fmtDate} from '@/lib/format'
import {Metric, StatusBadge, TierBadge, EmptyState} from '@/components/brand/primitives'
import SaveButton from '@/components/portal/SaveButton'
import ViewTracker from '@/components/portal/ViewTracker'
import PortableBlocks from '@/components/portal/PortableBlocks'
import EnquiryForm from '@/components/portal/EnquiryForm'
import {assetClassLabel, structureLabel} from '@/components/portal/OpportunityCard'

export const metadata: Metadata = {
  title: 'Opportunity',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function OpportunityDetailPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const ctx = await requirePortalUser()
  const uid = ctx.user.id

  const opportunity = await getOpportunityById(decodeURIComponent(id), ctx.effectiveTier)
  if (!opportunity) notFound()

  const o = opportunity

  const [saved, briefs, documents] = await Promise.all([
    supabase
      .from('saved_opportunities')
      .select('id')
      .eq('user_id', uid)
      .eq('sanity_id', o._id)
      .maybeSingle()
      .then((res) => unwrapNullable<Pick<SavedOpportunityRow, 'id'>>(res, 'savedOpportunities.check') !== null),
    getBriefs(ctx.effectiveTier),
    getDocuments(ctx.effectiveTier),
  ])

  // Briefs the studio linked to this opportunity
  const linkedBriefIds = new Set((o.availableBriefs || []).map((b) => b._ref))
  const relatedBriefs = briefs.filter((b) => b.linkedOpportunityId === o._id || linkedBriefIds.has(b._id))

  // Data-room documents for this opportunity
  const relatedDocuments = documents.filter((d) => d.linkedOpportunityId === o._id)

  const price = o.indicativePrice
  const geo = [o.geography?.district, o.geography?.city, o.geography?.country].filter(Boolean).join(' · ')
  const confidentialFinancials = !!o.financials && (o.financials.noi != null || o.financials.netYieldPct != null)

  return (
    <div className="space-y-8">
      <ViewTracker sanityId={o._id} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/portal/discover" className="hover:text-gold">Discover</Link>
        <span className="text-gold/60">/</span>
        <span className="truncate text-primary">{o.title}</span>
      </nav>

      {/* Header */}
      <header className="border border-border bg-card p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={o.status} />
              {o.status === 'off_market' ? <TierBadge tier="tier_2" /> : null}
              {o.status === 'auction' ? <TierBadge tier="tier_2" /> : null}
            </div>
            <h1 className="font-display text-3xl text-primary lg:text-4xl">{o.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gold/70" />
                {o.geography?.addressLine || geo || 'Location confidential at this tier'}
              </span>
              <span>{assetClassLabel(o.assetClass)}</span>
              {o.dealStructure ? <span>{structureLabel(o.dealStructure)}</span> : null}
              {o.publishDate ? <span>Published {fmtDate(o.publishDate)}</span> : null}
            </div>
            {o.summary ? <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{o.summary}</p> : null}
          </div>

          <div className="flex flex-col gap-3 lg:min-w-60 lg:border-l lg:border-border lg:pl-6">
            {price?.amount != null ? (
              <div>
                <div className="eyebrow mb-1">Indicative {price.basis || 'price'}</div>
                <div className="tabular font-display text-3xl text-primary">{fmtMoney(price.amount, price.currency || 'USD')}</div>
                {o.investmentSizeMin != null ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Ticket {fmtMoney(o.investmentSizeMin, price.currency || 'USD', {compact: true})}
                    {o.investmentSizeMax != null ? ` – ${fmtMoney(o.investmentSizeMax, price.currency || 'USD', {compact: true})}` : '+'}
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <div className="eyebrow mb-1">Guide</div>
                <div className="font-display text-xl text-muted-foreground">On application</div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <SaveButton sanityId={o._id} initialSaved={saved} />
                <Link
                  href={`/portal/compare?add=${encodeURIComponent(o._id)}`}
                  className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  <Columns3 className="h-3.5 w-3.5" /> Compare
                </Link>
              </div>
              {relatedBriefs.length > 0 ? (
                <Link
                  href={`/portal/orders?opportunity=${encodeURIComponent(o._id)}`}
                  className="inline-flex items-center justify-center gap-2 border border-primary bg-primary px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-forest-deep"
                >
                  <BookOpenCheck className="h-3.5 w-3.5" /> Request brief
                </Link>
              ) : (
                <Link
                  href={`/portal/orders?opportunity=${encodeURIComponent(o._id)}&custom=1`}
                  className="inline-flex items-center justify-center gap-2 border border-primary bg-primary px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-forest-deep"
                >
                  <BookOpenCheck className="h-3.5 w-3.5" /> Order institutional brief
                </Link>
              )}
              <Link
                href={`/portal/studio?opportunity=${encodeURIComponent(o._id)}`}
                className="inline-flex items-center justify-center gap-2 border border-gold/60 bg-gold/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:bg-gold/20"
              >
                <Calculator className="h-3.5 w-3.5" /> Model in Investment Studio
              </Link>
              {o.status === 'auction' && o.auctionUrl ? (
                <a
                  href={o.auctionUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center justify-center gap-2 border border-gold/60 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:bg-gold/10"
                >
                  <Eye className="h-3.5 w-3.5" /> Auction listing — auctions.murivest.com
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Financial summary */}
      <section>
        <div className="eyebrow mb-3">Investment summary</div>
        {!confidentialFinancials ? (
          <div className="flex items-start gap-3 border border-dashed border-gold/40 bg-gold/5 p-5">
            <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold" />
            <p className="text-xs leading-relaxed text-primary">
              Income, NOI, yields, occupancy and lease profile for this asset are confidential and available to verified investors. Complete KYC/AML verification and NDA acceptance to raise your access tier — or order the institutional brief for full underwriting on this asset.
            </p>
          </div>
        ) : (
          <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="NOI (annual)" value={o.financials!.noi != null ? fmtMoney(o.financials!.noi, o.financials!.financialCurrency || price?.currency || 'USD') : '—'} />
            <Metric label="Net yield" value={o.financials!.netYieldPct != null ? `${o.financials!.netYieldPct.toFixed(2)}%` : '—'} sub={o.financials!.grossYieldPct != null ? `gross ${o.financials!.grossYieldPct.toFixed(2)}%` : undefined} />
            <Metric label="Occupancy" value={o.financials!.occupancyPct != null ? `${o.financials!.occupancyPct.toFixed(1)}%` : '—'} sub={o.financials!.waultYears != null ? `WAULT ${o.financials!.waultYears.toFixed(1)} yrs` : undefined} />
            <Metric label="Gross income" value={o.financials!.grossIncomeAnnual != null ? fmtMoney(o.financials!.grossIncomeAnnual, o.financials!.financialCurrency || price?.currency || 'USD') : '—'} sub={o.financials!.operatingExpenses != null ? `opex ${fmtMoney(o.financials!.operatingExpenses, o.financials!.financialCurrency || 'USD')}` : undefined} />
          </div>
        )}
        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
          Figures as published by the Murivest desk · not verified valuations · not investment advice
        </p>
      </section>

      {/* Rationale + risks */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl text-primary">Investment rationale</h2>
          {o.investmentRationale ? (
            <PortableBlocks blocks={o.investmentRationale} />
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">Rationale is authored with the institutional brief for this asset.</p>
          )}
        </div>
        <div className="border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl text-primary">Key risks &amp; considerations</h2>
          {o.keyRisks && o.keyRisks.length > 0 ? (
            <ul className="space-y-2.5">
              {o.keyRisks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold/70" />
                  {risk}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">Risk disclosure accompanies the private brief for this asset.</p>
          )}
        </div>
      </section>

      {/* Lease profile */}
      {o.leaseProfile && o.leaseProfile.length > 0 ? (
        <section className="border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl text-primary">Lease profile</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Tenant</th>
                  <th className="pb-2 pr-4 font-medium">Area / share</th>
                  <th className="pb-2 pr-4 font-medium">Expiry</th>
                  <th className="pb-2 font-medium text-right">Annual income</th>
                </tr>
              </thead>
              <tbody>
                {o.leaseProfile.map((l) => (
                  <tr key={l._key} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 text-primary">{l.tenant || 'Confidential'}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{l.area || '—'}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{l.expires || '—'}</td>
                    <td className="tabular py-2.5 text-right text-primary">{l.income != null ? fmtMoney(l.income, o.financials?.financialCurrency || 'USD') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Documents */}
      <section className="border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-primary">Available documentation</h2>
          <Link href="/portal/documents" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
            Secure data room <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {relatedDocuments.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            No data-room material is currently published for this asset at your tier. Request access or order the private brief — the desk controls every document grant individually.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {relatedDocuments.map((d) => (
              <li key={d._id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileStack className="h-4 w-4 flex-shrink-0 text-gold/70" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-primary">{d.title}</div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {d.docType.replace('_', ' ')} {d.downloadable ? '' : '· preview only'}
                    </div>
                  </div>
                </div>
                <a href={`/api/documents/${encodeURIComponent(d._id)}/file`} target="_blank" rel="noreferrer noopener" className="flex-shrink-0 border border-border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Enquiry */}
      <section className="border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-gold" />
          <h2 className="font-display text-xl text-primary">Submit an enquiry</h2>
        </div>
        <EnquiryForm sanityOpportunityId={o._id} opportunityTitle={o.title} />
      </section>
    </div>
  )
}
