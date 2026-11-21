import type {Metadata} from 'next'
import Link from 'next/link'
import {ArrowRight, ArrowUpRight, Landmark, Lock, Scale, Search} from 'lucide-react'
import {ARTICLES} from '@/components/content/insights'
import {COMPANY} from '@/lib/constants'
import {fmtDate} from '@/lib/format'
import LandingHeader from '@/components/marketing/LandingHeader'
import {AuthModalProvider} from '@/components/marketing/AuthModalProvider'

export const metadata: Metadata = {
  title: 'Billionaire Real Estate Desk — Private Commercial Property for UHNW Capital',
  description:
    'How billionaires and UHNWIs actually buy commercial real estate — and the private alternative to LoopNet for investors deploying $20M+ directly: off-market Grade A opportunities, differential underwriting, DSCR-sized debt and mandate-only execution across East Africa and the UK.',
  keywords: [
    'billionaire real estate',
    'UHNWI commercial property',
    'LoopNet alternative',
    'private real estate platform',
    'off-market commercial property',
    'family office real estate desk',
    'Grant Cardone investors',
    'direct commercial real estate investment',
    'institutional real estate sourcing',
  ],
  alternates: {canonical: '/billionaire-real-estate'},
  openGraph: {
    title: 'The Billionaire Real Estate Desk — Murivest',
    description:
      'Marketplaces price the crowd\u2019s consensus. The desk prices the asset\u2019s reality. Off-market Grade A real estate with the underwriting on your side of the table.',
    type: 'website',
  },
  robots: {index: true, follow: true},
}

const FAQ_ITEMS = [
  {
    q: 'Where do billionaires buy commercial real estate?',
    a: 'Rarely on public marketplaces. The largest property fortunes are assembled through direct, relationship-sourced acquisitions — off-market approaches, auctions and distressed portfolios — with the underwriting evidence (rent roll, T-12, estoppels, title) negotiated privately before a price is ever bid against a crowd. This desk exists to give private investors that same channel.',
  },
  {
    q: 'Is this an alternative to LoopNet for serious investors?',
    a: 'For research and scanning, LoopNet is excellent — about 13 million monthly visitors and $205 billion of deals in 2025. But a listing is a seller\u2019s story at the consensus price, with no underwriting attached and every rival bidder seeing the same page. Murivest is the other channel: verification-gated, off-market flow with differential underwriting attached to every brief before capital moves.',
  },
  {
    q: 'What do I get access to as a verified investor?',
    a: 'Graduated, KYC/AML-verified tiers: matched off-market and auction-sourced Grade A opportunities, permission-gated financials and stress cases, the Investment Studio for capital-structure modelling, institutional briefs ordered in writing, documents with watermarked data-room delivery, and mandate-only execution with your advisor desk alongside.',
  },
  {
    q: 'How large are the deals on this desk?',
    a: 'The desk operates in the size band where direct mandates actually clear — Knight Frank\u2019s research shows family offices typically budget $20–30 million for commercial entry — across Kenya and East Africa, the United Kingdom, and other international markets, always direct and non-pooled, never commingled.',
  },
]

export default function BillionaireRealEstatePage() {
  const playbooks = ARTICLES.filter((a) => a.category === 'Billionaire Playbooks').slice(0, 4)

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {'@type': 'Answer', text: item.a},
    })),
  }

  return (
    <AuthModalProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(faqJsonLd)}} />
      <div className="flex min-h-screen flex-col bg-background">
        <LandingHeader isAuthenticated={false} />

        <main className="flex-1">
          {/* ============== HERO ============== */}
          <section className="bg-forest-deep text-ivory">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
              <div className="mb-5 inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.24em] text-gold">
                <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
                The UHNW desk · Private capital · Mandate-only
              </div>
              <h1 className="font-display text-4xl leading-[1.12] sm:text-5xl">
                Marketplaces price the crowd&rsquo;s consensus. This desk prices the asset&rsquo;s reality.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ivory/70">
                Forbes counts 400 more billionaires than a year ago, worth a record $20.1 trillion — and the property
                chapter of that list was not built on listing sites. It was built on direct acquisitions, income
                evidence, debt sized to coverage, and bases set where nobody else was bidding. This is the desk that
                runs that playbook for private capital: off-market Grade A commercial real estate, the differential
                underwriting attached, and your name on the deed.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/?auth=required"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-forest-deep transition-colors hover:bg-gold-deep hover:text-ivory"
                >
                  Request private access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/underwriting-calculator"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-ivory/40 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ivory transition-colors hover:border-gold hover:text-gold"
                >
                  Underwrite your property first
                </Link>
              </div>
              <ul className="mt-12 grid gap-3 sm:grid-cols-3">
                {[
                  'Direct, non-pooled ownership — your name on the deed, never commingled',
                  'Off-market, auction-sourced and matched opportunities — no public listing feed',
                  'Differential Underwriting on every brief — the assumptions on your side of the table',
                ].map((signal) => (
                  <li key={signal} className="flex items-start gap-2.5 border-l border-gold/40 pl-3 text-[11px] leading-relaxed text-ivory/60">
                    <Landmark className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold/80" aria-hidden="true" />
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ============== HOW THE BIG FORTUNES ARE ACTUALLY BUILT ============== */}
          <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
            <div className="eyebrow mb-4">How the fortunes are actually built</div>
            <h2 className="max-w-2xl font-display text-3xl leading-snug text-primary">
              Income, leverage discipline, basis — and no fund clock.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The pattern repeats across the property chapter of every billionaires list: quiet compounding income
              (Donald Bren&rsquo;s Irvine Company — $19.8 billion on roughly 129 million sq ft), downcycle basis (Sam
              Zell&rsquo;s $3 billion scavenging run after 1973), operator-grade process (the Cardone machine — 14,850+
              units), and patient capital with no forced disposals. Family offices already run the same structure:
              22.5% of the typical portfolio in direct real estate, per Knight Frank, with more than four in ten
              growing it.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['$20.1T', 'Record combined wealth on the Forbes 2026 billionaires list — up $4 trillion in a year'],
                ['22.5%', 'Of the typical family office portfolio already in direct real estate (Knight Frank 2025)'],
                ['129M sq ft', 'Of income-producing space behind America\u2019s largest real-estate fortune (Irvine Company)'],
                ['$205B', 'Of deals cleared on LoopNet in 2025 — priced at the crowd\u2019s consensus'],
              ].map(([stat, label]) => (
                <div key={stat} className="rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                  <div className="font-display text-3xl tabular text-primary">{stat}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ============== THE LOOPNET QUESTION ============== */}
          <section className="surface-band border-y border-border">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
              <div className="eyebrow mb-4">The LoopNet question</div>
              <h2 className="max-w-2xl font-display text-3xl leading-snug text-primary">
                Use the marketplace for scanning. Use the desk for the verdict.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                LoopNet is magnificent infrastructure — 13 million monthly visitors, listings that lease or sell 14%
                faster, CoStar-grade data behind it. It is also, by construction, the fully-exposed channel: every
                rival sees the same listing, the price forms at consensus, and the underwriting is your problem after
                the call. The spread serious capital hunts — between the seller&rsquo;s story and the asset&rsquo;s
                reality — is smallest exactly there.
              </p>
              <div className="mt-10 overflow-x-auto rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Dimension</th>
                      <th className="px-3 py-3 font-medium">A marketplace listing</th>
                      <th className="px-5 py-3 font-medium">This desk, under mandate</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {[
                      ['What you see', 'The seller\u2019s story: headline figures, best-month occupancy, photography', 'The asset\u2019s evidence: rent roll, T-12, estoppels, title, capex register'],
                      ['Underwriting', 'None attached — analysis is your problem after the call', 'Differential Underwriting attached to every brief before capital moves'],
                      ['Price formation', 'Consensus — every rival sees the same listing', 'Offer ladder anchored in basis points of defensible stabilized yield'],
                      ['Access', 'Open to anyone with a browser', 'Verification-gated: KYC/AML, classification, NDA, graduated tiers'],
                      ['Capital structure', 'Your own problem', 'DSCR-sized debt, capital-gap pathways and exit modelling in the Investment Studio'],
                      ['Best used for', 'Market scanning, rent evidence, comparable inventory', 'Acquisition verdicts, off-market access, mandate execution'],
                    ].map(([dim, listing, desk]) => (
                      <tr key={dim} className="border-b border-border/60 last:border-b-0">
                        <td className="px-5 py-3.5 font-medium text-primary">{dim}</td>
                        <td className="px-3 py-3.5 leading-6 text-foreground/75">{listing}</td>
                        <td className="px-5 py-3.5 leading-6 text-foreground/75">{desk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                href="/insights/loopnet-vs-institutional-sourcing"
                className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:text-gold"
              >
                The full LoopNet analysis <ArrowUpRight className="h-3.5 w-3.5 text-gold" />
              </Link>
            </div>
          </section>

          {/* ============== WHAT THE DESK RUNS ============== */}
          <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
            <div className="eyebrow mb-4">What the desk runs for you</div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {icon: Search, title: 'Sourcing', body: 'Off-market, auction-sourced and matched Grade A opportunities across Kenya, East Africa and the UK — surfaced by criteria matching against your stated preferences, never a public feed.'},
                {icon: Scale, title: 'Underwriting', body: 'Differential Underwriting on every opportunity: NOI in two states, cap-rate bands, DSCR-sized debt, stress cases and exit sensitivity — the Investment Studio lets you re-run every number under your own assumptions.'},
                {icon: Lock, title: 'Execution', body: 'Mandate-only execution with documented fees, watermarked data-room delivery, complete audit trails, and your advisor desk alongside from brief to deed.'},
              ].map((m) => (
                <div key={m.title} className="card-lift rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                  <m.icon className="h-5 w-5 text-gold" aria-hidden="true" />
                  <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{m.title}</div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ============== PLAYBOOKS READING LIST ============== */}
          <section className="surface-band border-y border-border">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
              <div className="eyebrow mb-6">The playbooks, underwritten</div>
              <div className="grid gap-5 md:grid-cols-2">
                {playbooks.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/insights/${a.slug}`}
                    className="card-lift group rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-colors hover:border-gold/50"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <span className="font-semibold text-gold">{a.tags[0]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{fmtDate(a.publishedAt)}</span>
                    </div>
                    <h3 className="mt-3 font-display text-lg leading-snug text-primary group-hover:text-gold">{a.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{a.dek}</p>
                  </Link>
                ))}
              </div>
              <Link
                href="/insights"
                className="mt-8 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:text-gold"
              >
                All desk insights <ArrowRight className="h-3.5 w-3.5 text-gold" />
              </Link>
            </div>
          </section>

          {/* ============== CTA ============== */}
          <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
            <div className="border border-gold/40 bg-gold/5 p-10 text-center lg:p-14">
              <div className="eyebrow mb-4">Verification-gated · Discreet · Mandate-only</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">
                If you are already buying off marketplaces, you are paying the consensus price.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Request private access, complete verification, and put the desk\u2019s differential between your capital
                and the next seller\u2019s story. Applying shares nothing beyond what verification lawfully requires.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/?auth=required"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-primary px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep"
                >
                  Request private access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/insights"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-border px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  Read the playbooks first
                </Link>
              </div>
            </div>
          </section>

          {/* ============== FAQ ============== */}
          <section className="mx-auto max-w-3xl px-6 pb-20 lg:px-10">
            <div className="eyebrow mb-6">Questions</div>
            <div className="divide-y divide-border border border-border bg-card">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold text-primary">
                    {item.q}
                    <span className="mt-1 h-px w-6 flex-shrink-0 bg-gold transition-transform group-open:rotate-45" aria-hidden="true" />
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
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
              <Link href="/insights" className="transition-colors hover:text-gold">Insights</Link>
            </span>
          </div>
        </footer>
      </div>
    </AuthModalProvider>
  )
}
