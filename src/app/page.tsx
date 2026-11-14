import type {Metadata} from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Building2,
  FileCheck2,
  Globe2,
  Landmark,
  Lock,
  MapPin,
  Scale,
  Search,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import {getAuthContext} from '@/lib/auth/context'
import {getLandingContent} from '@/lib/sanity/queries'
import {COMPANY, ENGAGEMENT_BASIS} from '@/lib/constants'
import LandingHeader from '@/components/marketing/LandingHeader'
import {AuthModalProvider} from '@/components/marketing/AuthModalProvider'
import {AuthTrigger} from '@/components/marketing/AuthTrigger'

export const metadata: Metadata = {
  title: 'Murivest Private Capital Portal — Direct Commercial Real Estate for UHNWIs & Family Offices',
  description:
    'The private capital allocation environment for ultra-high-net-worth individuals, family offices and institutional investors: off-market Grade A commercial real estate across Kenya, East Africa and the United Kingdom, institutional underwriting, capital-structure analysis and mandate-only execution under fiduciary standards.',
  alternates: {canonical: '/'},
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: COMPANY.legalName,
  alternateName: 'Murivest Group',
  url: COMPANY.siteUrl,
  description: COMPANY.description,
  email: COMPANY.email,
  telephone: COMPANY.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '4th Avenue Parklands, Diamond Plaza',
    addressLocality: 'Nairobi',
    addressCountry: 'KE',
  },
  areaServed: ['Kenya', 'East Africa', 'United Kingdom', 'International'],
  knowsAbout: [
    'Commercial real estate investment',
    'Grade A income-producing assets',
    'Property and asset management',
    'Investment structuring',
    'Off-market acquisitions',
  ],
  slogan: 'Private capital, allocated with institutional discipline.',
}

const VALUE_PROPS = [
  {
    icon: Search,
    title: 'Off-market opportunity intelligence',
    body: 'Discover direct, non-pooled commercial assets and alternatives — including off-market and auction-originated opportunities — permission-gated to your verification tier, never a public listing feed.',
  },
  {
    icon: BarChart3,
    title: 'Institutional underwriting, on demand',
    body: 'Order private and institutional investment briefs with transparent scope and delivery. NOI, yields, lease profiles, stress cases and downside scenarios prepared to a private-equity standard.',
  },
  {
    icon: Scale,
    title: 'Capital-structure clarity',
    body: 'Model leverage, hold periods and exit paths in the Investment Studio. When equity falls short, capital-gap analysis structures the pathway to executable — the deal is never simply dismissed.',
  },
  {
    icon: Lock,
    title: 'A secure, auditable workspace',
    body: 'One confidential environment for your mandates, documents, orders and decisions — with KYC/AML-graduated access, watermarked data-room delivery and a complete audit trail.',
  },
]

const AUDIENCES = [
  {
    icon: Landmark,
    title: 'UHNWIs & family offices',
    body: 'Personal and family capital deployed directly into Grade A income-producing assets — with the underwriting depth and discretion normally reserved for institutional programmes.',
  },
  {
    icon: Building2,
    title: 'Institutional allocators',
    body: 'Family offices, investment firms, funds, corporates and endowments sourcing and executing direct or co-invest style real estate exposure without pooling your capital.',
  },
  {
    icon: Globe2,
    title: 'Senior principals & executives',
    body: 'Decision-makers who evaluate direct allocation alongside — or instead of — large alternative managers, and expect off-market access, precision modelling and high-touch execution.',
  },
]

const PROCESS = [
  {step: '01', title: 'Verify & classify', body: 'KYC/AML verification and investor classification open graduated access to confidential material.'},
  {step: '02', title: 'Discover & underwrite', body: 'Permission-filtered opportunities, institutional briefs and downside scenarios on request.'},
  {step: '03', title: 'Model & structure', body: 'Criteria, capital-gap and financing scenarios in the Investment Studio — saved for your return.'},
  {step: '04', title: 'Mandate & execute', body: 'Formal acquisition mandates, secure data room, and transaction milestones with your advisor.'},
  {step: '05', title: 'Own & manage', body: 'Direct ownership with asset management, reporting and exit planning on your terms.'},
]

export default async function LandingPage() {
  const [ctx, landing] = await Promise.all([getAuthContext(), getLandingContent()])
  const isAuthenticated = !!ctx

  const hero = {
    eyebrow: landing?.heroEyebrow || 'Murivest Group · Private Capital',
    headline: landing?.heroHeadline || 'Allocate private capital with institutional discipline.',
    subline:
      landing?.heroSubline ||
      'The private workspace where ultra-high-net-worth individuals, family offices and institutional investors discover, underwrite, structure and execute commercial real estate and alternative investments — directly, discreetly, on a mandate-only basis.',
  }
  const credibility = landing?.credibility?.length
    ? landing.credibility
    : [
        'East Africa & United Kingdom coverage — Grade A income-producing assets',
        'Fiduciary standards · KYC/AML verified · NDA-gated confidential material',
        'Mandate-only engagements with transparent, documented fee structures',
      ]
  const markets = landing?.coverageMarkets?.length ? landing.coverageMarkets : COMPANY.coverage

  return (
    <AuthModalProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}} />
      <div className="flex min-h-screen flex-col bg-background">
        <LandingHeader isAuthenticated={isAuthenticated} />

        <main className="flex-1">
          {/* ================= HERO ================= */}
          <section className="bg-forest-deep text-ivory">
            <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.35fr_1fr] lg:px-10 lg:py-28">
              <div>
                <div className="mb-5 inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.24em] text-gold">
                  <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
                  {hero.eyebrow}
                </div>
                <h1 className="font-display text-4xl leading-[1.12] text-ivory sm:text-5xl lg:text-[3.4rem]">{hero.headline}</h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-ivory/70">{hero.subline}</p>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <AuthTrigger mode="access" variant="gold">
                    Request private access <ArrowRight className="h-4 w-4" />
                  </AuthTrigger>
                  {isAuthenticated ? (
                    <Link
                      href="/portal"
                      className="inline-flex items-center justify-center gap-2 border border-ivory/40 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-ivory transition-colors hover:border-gold hover:text-gold"
                    >
                      Enter workspace
                    </Link>
                  ) : (
                    <AuthTrigger mode="signin" variant="outline">
                      Client sign-in
                    </AuthTrigger>
                  )}
                </div>
                <ul className="mt-12 grid gap-3 sm:grid-cols-3">
                  {credibility.map((signal) => (
                    <li key={signal} className="flex items-start gap-2.5 border-l border-gold/40 pl-3 text-[11px] leading-relaxed text-ivory/60">
                      <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold/80" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>

              <aside className="border border-ivory/10 bg-black/20 p-8">
                <div className="eyebrow mb-4 !text-gold/80">Why principals allocate here</div>
                <ul className="space-y-5">
                  {[
                    'Exclusive and better-structured opportunities — including off-market and auction-sourced assets — that would otherwise be reached through large pooled managers.',
                    'Institutional-quality underwriting, stress tests and downside scenarios, visible quickly.',
                    'Capital structure, leverage, hold and exit modelling with precision — saved across sessions.',
                    'Deep institutional briefs ordered and paid for in moments.',
                    'Every interaction, document and decision tracked in one secure workspace.',
                  ].map((line) => (
                    <li key={line.slice(0, 24)} className="flex items-start gap-3 text-sm leading-relaxed text-ivory/75">
                      <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rotate-45 bg-gold" aria-hidden="true" />
                      {line}
                    </li>
                  ))}
                </ul>
                <div className="gold-rule my-6" />
                <p className="text-[11px] leading-relaxed text-ivory/50">
                  Murivest does not pool capital, operate collective investment schemes, or offer unlicensed financial products. Every engagement is mandate-only and subject to KYC/AML verification.
                </p>
              </aside>
            </div>
          </section>

          {/* ================= PLATFORM ================= */}
          <section id="platform" className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="mb-12 max-w-2xl">
              <div className="eyebrow mb-3">The platform</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">A private banking workspace for capital allocation — not a listing site.</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Five modules, one confidential environment: Discover, Investment Studio, Orders, Mandates and the secure Document Room — each designed for investors who deploy eight-to-nine-figure sums into income-producing commercial assets.
              </p>
            </div>
            <div className="grid gap-px border border-border bg-border md:grid-cols-2">
              {VALUE_PROPS.map((vp) => (
                <article key={vp.title} className="bg-card p-8">
                  <vp.icon className="mb-5 h-7 w-7 text-gold" strokeWidth={1.5} />
                  <h3 className="font-display text-xl text-primary">{vp.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{vp.body}</p>
                </article>
              ))}
            </div>
          </section>

          {/* ================= AUDIENCES ================= */}
          <section id="access" className="border-y border-border bg-secondary/40">
            <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
              <div className="mb-12 max-w-2xl">
                <div className="eyebrow mb-3">Built for</div>
                <h2 className="font-display text-3xl text-primary lg:text-4xl">Serious capital, verified counterparties.</h2>
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                {AUDIENCES.map((a) => (
                  <article key={a.title} className="border-t-2 border-gold/50 bg-card p-6">
                    <a.icon className="mb-4 h-6 w-6 text-gold" strokeWidth={1.5} />
                    <h3 className="font-display text-lg text-primary">{a.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                  </article>
                ))}
              </div>
              <div className="mt-10 border border-gold/30 bg-gold/5 p-6">
                <div className="flex items-start gap-4">
                  <Workflow className="mt-1 h-6 w-6 flex-shrink-0 text-gold" strokeWidth={1.5} />
                  <div>
                    <h3 className="font-display text-lg text-primary">Progressive, high-trust onboarding</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Registration opens a lightweight account. Verification, investor classification, NDA acceptance and internal review then unlock graduated tiers of confidential material — from opportunity financials to off-market briefs and the full data room. Access is never granted on registration alone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= PROCESS ================= */}
          <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="mb-12">
              <div className="eyebrow mb-3">The engagement arc</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">From first enquiry to owned asset.</h2>
            </div>
            <ol className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
              {PROCESS.map((p) => (
                <li key={p.step} className="bg-card p-6">
                  <div className="tabular font-display text-3xl text-gold/70">{p.step}</div>
                  <h3 className="mt-3 text-sm font-semibold text-primary">{p.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ================= COVERAGE ================= */}
          <section id="coverage" className="border-y border-border bg-secondary/40">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_1.2fr] lg:px-10">
              <div>
                <div className="eyebrow mb-3">Coverage</div>
                <h2 className="font-display text-2xl text-primary lg:text-3xl">East Africa roots. London desk. International reach.</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Principal offices in Nairobi and London, operating across the principal commercial sectors — office, industrial, retail, hospitality, mixed-use and land.
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {markets.map((m) => (
                  <li key={m} className="flex items-center gap-3 border border-border bg-card px-4 py-3.5 text-sm text-primary">
                    <MapPin className="h-4 w-4 text-gold" />
                    {m}
                  </li>
                ))}
                <li className="flex items-center gap-3 border border-gold/40 bg-gold/5 px-4 py-3.5 text-sm text-primary">
                  <FileCheck2 className="h-4 w-4 text-gold" />
                  <span>
                    Auction inventory via{' '}
                    <a href={COMPANY.auctionsUrl} target="_blank" rel="noreferrer noopener" className="underline decoration-gold/60 underline-offset-4 hover:text-gold">
                      auctions.murivest.com
                    </a>
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* ================= STANDARD ================= */}
          <section id="standard" className="bg-primary text-ivory">
            <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1fr] lg:px-10">
              <div>
                <div className="eyebrow mb-3 !text-gold/80">The standard</div>
                <h2 className="font-display text-3xl text-ivory lg:text-4xl">Fiduciary. Mandate-only. Non-pooled.</h2>
                <p className="mt-5 max-w-lg text-sm leading-relaxed text-ivory/70">{COMPANY.description}</p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <AuthTrigger mode="register" variant="gold">
                    Begin onboarding
                  </AuthTrigger>
                  <AuthTrigger mode="signin" variant="outline">
                    Sign in
                  </AuthTrigger>
                </div>
              </div>
              <ul className="space-y-4">
                {ENGAGEMENT_BASIS.map((b) => (
                  <li key={b} className="flex items-start gap-3 border-b border-ivory/10 pb-4 text-sm leading-relaxed text-ivory/75">
                    <Scale className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ================= CTA ================= */}
          <section id="contact" className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="border border-gold/40 bg-gold/5 p-10 text-center lg:p-16">
              <div className="eyebrow mb-4">Private access</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">Your capital deserves a quieter room.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Request access, complete verification, and begin allocating — with your Murivest advisor alongside at every step.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <AuthTrigger mode="access" variant="deep">
                  Request private access <ArrowRight className="h-4 w-4" />
                </AuthTrigger>
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="inline-flex items-center justify-center border border-border px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  {COMPANY.email}
                </a>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                {COMPANY.phone} · {COMPANY.address} · London desk
              </p>
            </div>
          </section>
        </main>

        {/* ================= FOOTER ================= */}
        <footer className="mt-auto border-t border-border bg-forest-deep text-ivory">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3 lg:px-10">
            <div>
              <div className="font-display text-lg font-semibold tracking-[0.08em] text-ivory">MURIVEST</div>
              <div className="gold-rule mt-2 w-10" />
              <p className="mt-4 text-xs leading-relaxed text-ivory/50">
                {COMPANY.legalName} — international commercial real estate services and investment firm. Grade A income-producing assets, on a direct, non-pooled, mandate-only basis.
              </p>
            </div>
            <div className="text-xs leading-relaxed text-ivory/60">
              <div className="eyebrow mb-3 !text-gold/70">Contact</div>
              <p>{COMPANY.email}</p>
              <p>{COMPANY.phone}</p>
              <p className="mt-2 text-ivory/45">{COMPANY.address}</p>
              <p className="text-ivory/45">London · United Kingdom</p>
            </div>
            <div className="text-xs leading-relaxed text-ivory/60">
              <div className="eyebrow mb-3 !text-gold/70">Notice</div>
              <p className="text-ivory/45">
                Confidential environment. Murivest does not pool capital or operate collective investment schemes. All engagements proceed under fiduciary standards, applicable KYC/AML requirements and formal scope documentation. Communications may be monitored for security purposes under applicable law.
              </p>
            </div>
          </div>
          <div className="border-t border-ivory/10">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-[10px] uppercase tracking-[0.18em] text-ivory/40 sm:flex-row sm:items-center sm:justify-between lg:px-10">
              <span>© {new Date().getFullYear()} {COMPANY.legalName} · Strictly confidential</span>
              <span>
                <a href={COMPANY.auctionsUrl} target="_blank" rel="noreferrer noopener" className="hover:text-gold">auctions.murivest.com</a>
              </span>
            </div>
          </div>
        </footer>
      </div>
    </AuthModalProvider>
  )
}
