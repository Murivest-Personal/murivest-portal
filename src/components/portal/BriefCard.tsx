import Link from 'next/link'
import {BookOpen} from 'lucide-react'
import {TierBadge} from '@/components/brand/primitives'

export interface BriefRow {
  id: string
  title: string
  slug: string | null
  briefType: string
  accessTier: string
  description: string | null
  deliveryExpectations: string | null
  coverImageUrl: string | null
  coverImageAlt: string | null
  digitalKes: number | null
  digitalUsd: number | null
  hardKes: number | null
  hardUsd: number | null
  digitalDownloadAvailable: boolean
  hardCopyAvailable: boolean
  linkedOpportunityId: string | null
}

/** Resolve the best price label for an edition. */
export function priceLabel(
  kes: number | null,
  usd: number | null,
  available: boolean,
): string {
  if (!available) return 'Unavailable'
  if (kes == null && usd == null) return '—'
  if (kes != null && kes > 0) return `KES ${kes.toLocaleString()}`
  if (usd != null && usd > 0) return `USD ${usd.toLocaleString()}`
  return 'Complimentary'
}

export function BriefCard({brief}: {brief: BriefRow}) {
  const digital = priceLabel(brief.digitalKes, brief.digitalUsd, brief.digitalDownloadAvailable)
  const hard = priceLabel(brief.hardKes, brief.hardUsd, brief.hardCopyAvailable)
  const href = `/portal/property-briefs/${brief.slug ?? brief.id}`

  return (
    <article className="rounded-card flex flex-col overflow-hidden border border-border bg-card shadow-card">
      {brief.coverImageUrl ? (
        <Link href={href} className="block aspect-[16/9] w-full overflow-hidden bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brief.coverImageUrl}
            alt={brief.coverImageAlt ?? brief.title}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            loading="lazy"
          />
        </Link>
      ) : (
        <Link
          href={href}
          className="flex aspect-[16/9] w-full items-center justify-center bg-secondary"
        >
          <BookOpen className="h-8 w-8 text-gold/60" />
        </Link>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="rounded-micro bg-secondary px-2 py-0.5 text-secondary-foreground">
            {brief.briefType === 'institutional_brief' ? 'Institutional brief' : 'Private brief'}
          </span>
          <TierBadge tier={brief.accessTier as 'tier_1' | 'tier_2' | 'tier_3'} />
        </div>
        <h3 className="font-display text-lg leading-tight text-primary">
          <Link href={href} className="transition-colors hover:text-gold">
            {brief.title}
          </Link>
        </h3>
        {brief.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {brief.description}
          </p>
        ) : null}
        {brief.deliveryExpectations ? (
          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80">
            {brief.deliveryExpectations}
          </p>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <div>
            <dt>Digital edition</dt>
            <dd className="mt-0.5 text-sm normal-case tracking-normal text-primary">{digital}</dd>
          </div>
          <div>
            <dt>Hard copy</dt>
            <dd className="mt-0.5 text-sm normal-case tracking-normal text-primary">{hard}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Link
            href={href}
            className="rounded-pill inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-forest-deep"
          >
            <BookOpen className="h-3.5 w-3.5" />
            View &amp; order
          </Link>
          {brief.linkedOpportunityId ? (
            <Link
              href={`/portal/property-briefs/${brief.linkedOpportunityId}`}
              className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary"
            >
              Linked opportunity
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}