import Link from 'next/link'
import {Eye, MapPin, Layers, Building2, ArrowUpRight} from 'lucide-react'
import type {OpportunityDoc} from '@/lib/sanity/types'
import {fmtMoney} from '@/lib/format'
import {InlineTag, StatusBadge} from '@/components/brand/primitives'
import SaveButton from './SaveButton'
import {ASSET_CLASS_OPTIONS, DEAL_STRUCTURE_OPTIONS, OPPORTUNITY_STATUS_OPTIONS} from '@/lib/constants'

export function assetClassLabel(v?: string | null) {
  return ASSET_CLASS_OPTIONS.find((o) => o.value === v)?.label || v || '—'
}
export function structureLabel(v?: string | null) {
  return DEAL_STRUCTURE_OPTIONS.find((o) => o.value === v)?.label || v || '—'
}
export function statusLabel(v: string) {
  return OPPORTUNITY_STATUS_OPTIONS.find((o) => o.value === v)?.label || v
}

/**
 * Opportunity card — institutional presentation, never marketplace-y.
 * Only tier-permitted financial fields reach the client; the component
 * renders "not disclosed" for fields the studio left empty rather than
 * fabricating anything.
 */
export default function OpportunityCard({
  opportunity,
  saved,
  matchedTags,
  viewCount,
}: {
  opportunity: OpportunityDoc
  saved: boolean
  matchedTags?: string[]
  viewCount?: number
}) {
  const o = opportunity
  const geo = [o.geography?.district, o.geography?.city, o.geography?.country].filter(Boolean).join(' · ')
  const price = o.indicativePrice
  const showFinancials = !!o.financials?.noi || !!o.financials?.netYieldPct

  return (
    <article className="card-lift group overflow-hidden rounded-card border border-border bg-card shadow-card transition-colors hover:border-gold/40">
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={o.status} />
            {o.status === 'auction' ? <InlineTag className="!bg-gold/15 !text-primary">Auction asset</InlineTag> : null}
            {matchedTags?.map((t) => (
              <InlineTag key={t} className="!bg-primary/5 !text-primary">{t}</InlineTag>
            ))}
            {typeof viewCount === 'number' && viewCount >= 5 ? <InlineTag>High interest</InlineTag> : null}
          </div>

          <Link href={`/portal/discover/${encodeURIComponent(o._id)}`} className="font-display text-xl text-primary transition-colors hover:text-gold lg:text-2xl">
            {o.title}
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gold/70" /> {geo || 'Location confidential'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-gold/70" /> {assetClassLabel(o.assetClass)}
            </span>
            {o.dealStructure ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-gold/70" /> {structureLabel(o.dealStructure)}
              </span>
            ) : null}
          </div>

          {o.summary ? <p className="mt-4 line-clamp-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{o.summary}</p> : null}

          {showFinancials ? (
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
              {o.financials?.noi != null ? (
                <span className="text-muted-foreground">
                  NOI <span className="tabular font-semibold text-primary">{fmtMoney(o.financials.noi, o.financials.financialCurrency || 'USD')}</span>
                </span>
              ) : null}
              {o.financials?.netYieldPct != null ? (
                <span className="text-muted-foreground">
                  Net yield <span className="tabular font-semibold text-primary">{o.financials.netYieldPct.toFixed(2)}%</span>
                </span>
              ) : null}
              {o.financials?.occupancyPct != null ? (
                <span className="text-muted-foreground">
                  Occupancy <span className="tabular font-semibold text-primary">{o.financials.occupancyPct.toFixed(1)}%</span>
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-xs italic text-muted-foreground">Financial detail available at higher verification tiers and on request.</p>
          )}
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-border pt-4 lg:min-w-56 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {price?.amount != null ? (
            <div>
              <div className="eyebrow mb-1">Indicative</div>
              <div className="tabular font-display text-2xl text-primary">{fmtMoney(price.amount, price.currency || 'USD')}</div>
              {price.basis ? <div className="text-[11px] text-muted-foreground">{price.basis}</div> : null}
            </div>
          ) : (
            <div>
              <div className="eyebrow mb-1">Guide</div>
              <div className="font-display text-lg text-muted-foreground">On application</div>
            </div>
          )}

          <div className="flex w-full flex-col gap-2 lg:items-stretch">
            <div className="flex gap-2">
              <SaveButton sanityId={o._id} initialSaved={saved} />
              <Link
                href={`/portal/compare?add=${encodeURIComponent(o._id)}`}
                className="press-scale rounded-standard inline-flex items-center justify-center border border-border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:border-gold hover:text-gold"
              >
                Compare
              </Link>
            </div>
            <Link
              href={`/portal/discover/${encodeURIComponent(o._id)}`}
              className="press-scale rounded-pill inline-flex items-center justify-center gap-1.5 border border-primary bg-primary px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground shadow-card transition-colors hover:bg-forest-deep"
            >
              Opportunity detail <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {o.status === 'auction' && o.auctionUrl ? (
        <a
          href={o.auctionUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-2 border-t border-gold/30 bg-gold/5 px-6 py-2.5 text-[11px] uppercase tracking-[0.14em] text-primary transition-colors hover:bg-gold/10"
        >
          <Eye className="h-3.5 w-3.5 text-gold" /> View auction listing — auctions.murivest.com <ArrowUpRight className="h-3 w-3" />
        </a>
      ) : null}
    </article>
  )
}
