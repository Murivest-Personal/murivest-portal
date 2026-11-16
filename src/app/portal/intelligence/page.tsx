import type {Metadata} from 'next'
import Link from 'next/link'
import {Newspaper, MapPin} from 'lucide-react'
import {requirePortalUser} from '@/lib/auth/context'
import {getMarketReports} from '@/lib/sanity/queries'
import {isSanityConfigured} from '@/lib/sanity/client'
import {fmtDate} from '@/lib/format'
import {EmptyState, TierBadge} from '@/components/brand/primitives'

export const metadata: Metadata = {
  title: 'Market Intelligence',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

const CATEGORY_LABEL: Record<string, string> = {
  market_report: 'Market report',
  country_insight: 'Country insight',
  sector_insight: 'Sector insight',
  trend: 'Trend analysis',
  economic_indicator: 'Economic indicator',
  commentary: 'Murivest commentary',
}

export default async function IntelligencePage() {
  const ctx = await requirePortalUser()
  const reports = await getMarketReports(ctx.effectiveTier)

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Curated research &amp; insight</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Market Intelligence</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Market reports, country and sector insights, trend analysis and economic indicators relevant to real estate capital allocation across our coverage markets. High-signal material only — curated by the Murivest desk and permissioned by tier.
        </p>
      </div>

      {!isSanityConfigured() ? (
        <EmptyState
          icon={Newspaper}
          title="Intelligence awaits publication"
          body="Research and commentary are authored by the Murivest desk through the content studio. When the first pieces go live they appear here, permission-filtered — the portal never substitutes generic filler for insight."
        />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Nothing published at your tier"
          body="Intelligence visible to you is governed by verification tier. Complete KYC to raise your tier, or order a market-specific institutional brief through Orders."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {reports.map((r) => (
            <article key={r._id} className="flex flex-col rounded-card border border-border bg-card shadow-card p-6 transition-colors hover:border-gold/40">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary-foreground">
                  {CATEGORY_LABEL[r.category] || r.category}
                </span>
                <TierBadge tier={r.accessTier} />
              </div>
              <Link href={`/portal/intelligence/${encodeURIComponent(r._id)}`} className="font-display text-xl text-primary transition-colors hover:text-gold">
                {r.title}
              </Link>
              {r.geography ? (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-gold/70" /> {r.geography}
                </div>
              ) : null}
              {r.summary ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{r.summary}</p> : null}
              <div className="mt-auto pt-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {r.publishDate ? fmtDate(r.publishDate) : ''} · Read the analysis →
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
