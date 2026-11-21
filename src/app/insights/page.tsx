import type {Metadata} from 'next'
import Link from 'next/link'
import {ArrowRight, ArrowUpRight} from 'lucide-react'
import {ARTICLES, INSIGHT_CATEGORIES, articlesByCategory, readMinutes} from '@/components/content/insights'
import {COMPANY} from '@/lib/constants'
import {fmtDate} from '@/lib/format'
import LandingHeader from '@/components/marketing/LandingHeader'
import {AuthModalProvider} from '@/components/marketing/AuthModalProvider'

export const metadata: Metadata = {
  title: 'Insights — Billionaire Real Estate Strategies, Research & Underwriting Method',
  description:
    'Murivest desk research for UHNW and institutional direct investors: billionaire commercial real estate playbooks, Forbes/Harvard/McKinsey/CBRE research digests, and the Differential Underwriting method — written by Mark Muriithi, Managing Director & Differential Underwriter.',
  keywords: [
    'billionaire real estate',
    'commercial real estate insights',
    'UHNWI investment research',
    'real estate underwriting',
    'family office direct investment',
    'Grant Cardone strategy',
    'Sam Zell playbook',
    'cap rate analysis',
    'DSCR calculator',
    'LoopNet alternative',
  ],
  alternates: {canonical: '/insights'},
  openGraph: {
    title: 'Murivest Insights — Research & Playbooks for Direct Real Estate Capital',
    description:
      'Billionaire playbooks, Forbes/Harvard/McKinsey research digests and the Differential Underwriting method — the desk view for UHNW and institutional direct investors.',
    type: 'website',
  },
  robots: {index: true, follow: true},
}

export default function InsightsHubPage() {
  const featured = ARTICLES.filter((a) => a.featured).slice(0, 3)

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Murivest Insights',
    description: 'Desk research and playbooks for direct commercial real estate investors.',
    url: `${COMPANY.siteUrl.replace(/\/$/, '')}/insights`,
    publisher: {'@type': 'Organization', name: COMPANY.legalName, url: COMPANY.siteUrl},
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: ARTICLES.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${COMPANY.siteUrl.replace(/\/$/, '')}/insights/${a.slug}`,
        name: a.title,
      })),
    },
  }

  return (
    <AuthModalProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(collectionJsonLd)}} />
      <div className="flex min-h-screen flex-col bg-background">
        <LandingHeader isAuthenticated={false} />

        <main className="flex-1">
          {/* ============== HERO ============== */}
          <section className="bg-forest-deep text-ivory">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
              <div className="mb-5 inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.24em] text-gold">
                <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
                Murivest desk · Differential research
              </div>
              <h1 className="font-display text-4xl leading-[1.12] sm:text-5xl">
                Insights for capital that reads the footnotes.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ivory/70">
                Billionaire playbooks read as underwriting lessons, the research of Forbes, Harvard, McKinsey and CBRE
                digested the differential way, and the working method of this desk — {ARTICLES.length} articles, every
                assumption flagged, every source cited.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/underwriting-calculator"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-forest-deep transition-colors hover:bg-gold-deep hover:text-ivory"
                >
                  Run the underwriting engine <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/differential-underwriting"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-ivory/40 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ivory transition-colors hover:border-gold hover:text-gold"
                >
                  The method, explained
                </Link>
              </div>
            </div>
          </section>

          {/* ============== FEATURED ============== */}
          <section className="mx-auto max-w-6xl px-6 py-14 lg:px-10">
            <div className="eyebrow mb-6">Featured research</div>
            <div className="grid gap-6 md:grid-cols-3">
              {featured.map((a) => (
                <Link
                  key={a.slug}
                  href={`/insights/${a.slug}`}
                  className="card-lift group flex flex-col rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-colors hover:border-gold/50"
                >
                  <span className="inline-flex w-fit rounded-[3px] border border-gold/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
                    {a.category}
                  </span>
                  <h2 className="mt-4 font-display text-lg leading-snug text-primary group-hover:text-gold">{a.title}</h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{a.dek}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <span>{fmtDate(a.publishedAt)} · {readMinutes(a)} min</span>
                    <ArrowUpRight className="h-4 w-4 text-gold" aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ============== ALL ARTICLES BY CATEGORY ============== */}
          {INSIGHT_CATEGORIES.map((category) => {
            const list = articlesByCategory(category)
            if (!list.length) return null
            return (
              <section key={category} className="mx-auto max-w-6xl px-6 pb-14 lg:px-10">
                <div className="mb-6 flex items-center gap-4">
                  <h2 className="font-display text-2xl text-primary">{category}</h2>
                  <span className="gold-rule w-12" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {list.length} article{list.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  {list.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/insights/${a.slug}`}
                      className="card-lift group flex flex-col rounded-[16px] border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-gold/50 sm:p-6"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        <span className="font-semibold text-gold">{a.tags[0]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{fmtDate(a.publishedAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{readMinutes(a)} min</span>
                      </div>
                      <h3 className="mt-3 font-display text-lg leading-snug text-primary group-hover:text-gold">{a.title}</h3>
                      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{a.dek}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}

          {/* ============== CTA ============== */}
          <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
            <div className="border border-gold/40 bg-gold/5 p-10 text-center lg:p-14">
              <div className="eyebrow mb-4">The desk behind these pages</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">
                Mark Muriithi — the differential in commercial real estate.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Request private access to run your own deals inside the workspace — off-market Grade A opportunities
                across East Africa and the UK, with the underwriting on your side of the table.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/?auth=required"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-primary px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep"
                >
                  Request private access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/billionaire-real-estate"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-border px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  The UHNW desk
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* ============== FOOTER ============== */}
        <footer className="mt-auto border-t border-border bg-forest-deep py-8 text-ivory">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-[10px] uppercase tracking-[0.18em] text-ivory/40 sm:flex-row sm:items-center sm:justify-between lg:px-10">
            <span>© {new Date().getFullYear()} {COMPANY.legalName} · Differential Underwriting · Mandate-only</span>
            <span className="flex items-center gap-4">
              <Link href="/differential-underwriting" className="transition-colors hover:text-gold">Method</Link>
              <Link href="/underwriting-calculator" className="transition-colors hover:text-gold">Calculator</Link>
              <Link href="/billionaire-real-estate" className="transition-colors hover:text-gold">UHNW desk</Link>
            </span>
          </div>
        </footer>
      </div>
    </AuthModalProvider>
  )
}
