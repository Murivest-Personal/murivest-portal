import type {Metadata} from 'next'
import Link from 'next/link'
import {ArrowRight} from 'lucide-react'
import {UnderwritingStudio} from '@/components/marketing/UnderwritingStudio'
import {COMPANY} from '@/lib/constants'
import LandingHeader from '@/components/marketing/LandingHeader'
import {AuthModalProvider} from '@/components/marketing/AuthModalProvider'

export const metadata: Metadata = {
  title: 'Commercial Real Estate Underwriting Calculator — The Differential Engine',
  description:
    'Run a differential underwrite on any commercial property: enter location, income, lease, owner and building specifics and get the price to offer (offer ladder), the price to set to let (rent guidance) and the maximum loan to access (DSCR debt sizing) — free, instant, nothing stored.',
  keywords: [
    'commercial real estate underwriting calculator',
    'CRE calculator',
    'cap rate calculator',
    'DSCR calculator',
    'maximum commercial loan calculator',
    'NOI calculator',
    'property valuation calculator',
    'rent guidance calculator',
    'offer price calculator',
  ],
  alternates: {canonical: '/underwriting-calculator'},
  openGraph: {
    title: 'The Differential Underwriting Engine — Murivest',
    description:
      'What price to give your property. What price to set to let. What loan to access. The differential engine answers all three from your own inputs.',
    type: 'website',
  },
  robots: {index: true, follow: true},
}

const FAQ_ITEMS = [
  {
    q: 'What does this commercial real estate calculator do?',
    a: 'It runs a differential underwrite on your inputs: three competing explanations of value (the seller\u2019s story, the in-place reality, and the stabilised case net of re-leasing costs), an offer ladder with opening offer, target zone and walk-away price, the maximum loan a lender would support at your DSCR floor, and the rent the asset must achieve to justify its asking price.',
  },
  {
    q: 'What inputs do I need?',
    a: 'Location and market archetype, lettable area, fully-let monthly income, current occupancy, the asking price, your market cap rate, operating expense ratios, the re-leasing programme (fit-out contribution and downtime) and debt terms (rate, amortisation, DSCR floor). A worked Nairobi CBD example is preloaded so you can see the method before you enter your own property.',
  },
  {
    q: 'How is the maximum loan calculated?',
    a: 'Maximum supportable loan equals stabilised NOI divided by the DSCR floor, divided by the annual debt constant. The debt constant is total annual debt service per unit of loan at your rate and amortisation — lenders typically require 1.20× to 1.30× coverage on stabilised income, so the income, not the valuation, sets the ceiling.',
  },
  {
    q: 'Is this investment advice or a valuation?',
    a: 'No. The engine computes illustrative arithmetic from the figures you enter — nothing is stored, nothing is advice. A bankable valuation requires the evidence layer: reconciled rent roll, T-12, estoppels, title and a capex register, verified at the transaction date. The mandate version of this work is exactly that.',
  },
]

export default function UnderwritingCalculatorPage() {
  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Murivest Differential Underwriting Engine',
    url: `${COMPANY.siteUrl.replace(/\/$/, '')}/underwriting-calculator`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description:
      'Free commercial real estate underwriting calculator: three competing explanations of value, offer ladder, DSCR debt sizing and rent guidance from your own property inputs.',
    offers: {'@type': 'Offer', price: 0, priceCurrency: 'USD'},
    publisher: {'@type': 'Organization', name: COMPANY.legalName, url: COMPANY.siteUrl},
  }

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(appJsonLd)}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(faqJsonLd)}} />
      <div className="flex min-h-screen flex-col bg-background">
        <LandingHeader isAuthenticated={false} />

        <main className="flex-1">
          {/* ============== HERO + STUDIO ============== */}
          <section className="bg-forest-deep text-ivory">
            <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10 lg:py-20">
              <div className="mb-5 inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.24em] text-gold">
                <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
                The differential engine · free · nothing stored
              </div>
              <h1 className="font-display text-4xl leading-[1.12] sm:text-5xl">
                What price to give. What price to let. What loan to access.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ivory/70">
                Enter your property&rsquo;s location, income, lease, owner and building specifics. The engine runs the
                differential underwrite in one request — the three competing explanations of value, the offer ladder,
                the debt ceiling and the rent guidance — before you believe anybody&rsquo;s brochure, including ours.
              </p>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 py-12 lg:px-10 lg:py-16">
            <UnderwritingStudio />
          </section>

          {/* ============== HOW IT WORKS ============== */}
          <section className="surface-band border-y border-border">
            <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10 lg:py-20">
              <div className="eyebrow mb-4">The arithmetic under the bonnet</div>
              <h2 className="max-w-2xl font-display text-3xl leading-snug text-primary">
                Every output is a formula you can audit.
              </h2>
              <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[
                  ['NOI, two states', 'Net operating income computed in-place (today\u2019s occupancy and costs) and stabilised (target occupancy at market opex). The gap between them is the execution value.'],
                  ['Value at a cap-rate band', 'Value = NOI ÷ cap rate, run across a ±50bp band — because a point estimate is a negotiation posture, not a fact.'],
                  ['Debt constant & max loan', 'Maximum loan = (stabilised NOI ÷ DSCR floor) ÷ annual debt constant. The income, never the price, sets the ceiling.'],
                  ['Offer ladder', 'Opening offer, target zone and hard walk-away priced at the market cap rate plus 250bp, 100–150bp and 50bp of defensible yield.'],
                  ['Rent guidance', 'The rent the asset must achieve for its value to equal the asking price — and the re-gear uplift that would close the spread.'],
                  ['Differential spread', 'Asking price minus the stabilised net value. The number an investment committee actually asks about: what do you know that the market has not priced?'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{title}</div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============== FAQ ============== */}
          <section className="mx-auto max-w-3xl px-6 py-14 lg:px-10">
            <div className="eyebrow mb-6">Questions about the calculator</div>
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

          {/* ============== CTA ============== */}
          <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
            <div className="border border-gold/40 bg-gold/5 p-10 text-center lg:p-14">
              <div className="eyebrow mb-4">From arithmetic to evidence</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">
                The engine prices the arithmetic. The mandate prices the asset.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Request private access to run deals inside the workspace: off-market Grade A opportunities across East
                Africa and the UK, the full data-room evidence, and the desk\u2019s Differential Verdict on your side of
                the table.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/?auth=required"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-primary px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep"
                >
                  Request private access <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/differential-underwriting"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-border px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  The method, explained
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
              <Link href="/insights" className="transition-colors hover:text-gold">Insights</Link>
              <Link href="/billionaire-real-estate" className="transition-colors hover:text-gold">UHNW desk</Link>
            </span>
          </div>
        </footer>
      </div>
    </AuthModalProvider>
  )
}
