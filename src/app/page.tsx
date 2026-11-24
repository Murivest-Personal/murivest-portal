import type {Metadata} from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Download,
  FileCheck2,
  Globe2,
  Landmark,
  Lock,
  MapPin,
  Play,
  Scale,
  Search,
  ShieldCheck,
  Workflow,
  XCircle,
} from 'lucide-react'
import {getAuthContext} from '@/lib/auth/context'
import {getLandingContent, getImageAssetUrl} from '@/lib/sanity/queries'
import {COMPANY, ENGAGEMENT_BASIS} from '@/lib/constants'
import LandingHeader from '@/components/marketing/LandingHeader'
import {AuthModalProvider} from '@/components/marketing/AuthModalProvider'
import {AuthTrigger} from '@/components/marketing/AuthTrigger'

export const metadata: Metadata = {
  title: 'Investor Suite by Murivest | Private Commercial Real Estate Investment Platform',
  description:
    'Investor Suite is Murivest’s private digital environment for qualified investors, principals and family offices to review curated commercial real estate opportunities, investment analysis, mandates and confidential portfolio information.',
  keywords: [
    'private commercial real estate',
    'off-market commercial property',
    'family office real estate',
    'UHNWI investment platform',
    'alternatives to large private equity managers',
    'Nairobi commercial real estate investment',
    'Kenya Grade A income-producing assets',
    'London commercial property desk',
    'direct non-pooled real estate investment',
    'institutional property underwriting',
  ],
  alternates: {canonical: '/'},
  openGraph: {
    title: 'Murivest Investor Suite — See the underwriting before you write the cheque',
    description:
      'Direct, non-pooled, mandate-only access to Grade A commercial real estate across East Africa and the UK — with institutional underwriting, stress tests and exit modelling on your side of the table.',
    type: 'website',
  },
}

const MANUAL_PATH = '/downloads/murivest-portal-user-manual.pdf'
const SCRIPT_PATH = '/downloads/murivest-director-video-script.md'

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
  slogan: 'See the underwriting before you write the cheque.',
}

const FAQ_ITEMS = [
  {
    q: 'Why not simply allocate through a large global manager?',
    a: 'For many mandates, large managers are exactly the right answer — and we will say so. What they offer is exposure to a professionally managed pool. What they do not offer is your name on the deed, veto rights on the asset, or the raw underwriting behind the projection. Murivest exists for capital that wants the second option: direct, non-pooled ownership on a mandate-only basis, with the assumptions on your side of the table. Some clients use us alongside their existing programme; some use us instead of it.',
  },
  {
    q: 'Is this a fund? Do you pool my capital?',
    a: 'No. Murivest Group Ltd does not pool capital and does not operate collective investment schemes. Every engagement proceeds on a direct, non-pooled, mandate-only basis under fiduciary standards and applicable KYC/AML requirements. You acquire, own and control the asset — with asset management available as a documented service.',
  },
  {
    q: 'What does it cost to use Investor Suite?',
    a: 'Applying for access costs nothing and shares nothing beyond what verification lawfully requires. Investment briefs are priced per scope, displayed before you commit to payment, and delivered through a tracked fulfilment workflow. Engagement fees for mandates are documented and agreed in writing before any work begins — never percentage-of-capital surprises. Specific figures appear on each brief and each mandate proposal, because pricing detached from scope is exactly the practice Investor Suite was designed to make clear.',
  },
  {
    q: 'East Africa — how do I deal with the risk question?',
    a: 'Every market carries risk; pretending otherwise is how brochures sell property. The difference is whether you see the downside before you commit. Murivest underwriting shows vacancy stress cases, yield sensitivity, tenant-concentration and exit-cap rate ranges alongside the base case — and the Investment Studio lets you re-run every number under your own assumptions. Markets reward investors who can price risk, not investors who ignore it.',
  },
  {
    q: 'How private is my information?',
    a: 'Investor Suite is verification-gated and KYC/AML-checked. Data-room documents are watermarked, download-logged and served through expiring, non-guessable access. Sessions are device-recognised and individually revocable. Your details are never sold, never shared for marketing, and confidential material is never accessible on registration alone.',
  },
  {
    q: 'What if I request access and then decide not to proceed?',
    a: 'Nothing happens. Your access simply lapses with inactivity, and no one chases you. Keep the investor manual, keep the Director\u2019s script, take whatever is useful. We would rather earn a mandate in a year than pressure a decision in a week — Investor Suite is designed for people who prefer to make decisions without pressure.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {'@type': 'Answer', text: item.a},
  })),
}

/** The six questions a Blackstone-level principal asks — and the module that answers each. */
const SIX_ANSWERS = [
  {
    icon: Search,
    question: 'What exclusive, better-structured opportunities exist right now?',
    answer:
      'Discover filters off-market, auction-sourced and marketed Grade A assets to your verification tier — with transparent criteria matching against your stated preferences, never a public listing feed.',
    module: 'Discover',
  },
  {
    icon: BarChart3,
    question: 'Can I see institutional underwriting and stress tests?',
    answer:
      'Permission-gated financials — NOI, yields, lease profile, investment rationale and key risks — plus curated Market Intelligence. Institutional briefs with downside scenarios are orderable in writing.',
    module: 'Intelligence & Briefs',
  },
  {
    icon: Scale,
    question: 'Can I model capital structure, leverage and exits myself?',
    answer:
      'The Investment Studio: criteria workspace, illustrative financing scenarios, rate-and-exit sensitivity grids, capital-gap pathways and exit strategy — every scenario saved for your return.',
    module: 'Investment Studio',
  },
  {
    icon: FileCheck2,
    question: 'Can I order — and pay for — a deep institutional brief in minutes?',
    answer:
      'Orders: private and institutional briefs with explicit scope, price and delivery expectations, paid by M-Pesa, wire or card, and tracked Pending, In Progress, Ready, Delivered — with a full audit trail.',
    module: 'Orders',
  },
  {
    icon: Workflow,
    question: 'Is everything tracked in one private environment?',
    answer:
      'Mandates, documents, portfolio positions, advisor threads and every action in between — one auditable environment with watermarked data-room delivery and complete access logs.',
    module: 'Investor Suite & Documents',
  },
  {
    icon: Lock,
    question: 'Will this stay private, high-signal and noise-free?',
    answer:
      'Graduated access, NDA-gated confidential material, device-level session control — and no marketing churn. Investor Suite was designed to be the quietest room your capital occupies.',
    module: 'Account & Security',
  },
]

const NOT_STATEMENTS = [
  {
    title: 'Not a pooled fund.',
    body: 'Your capital is never commingled. No units, no NAV, no lock-ups. You acquire the asset directly, in your name or your structure — with the underwriting in front of you, not behind a manager.',
  },
  {
    title: 'Not a listing site.',
    body: 'There is no public feed and no noise. Opportunities surface through criteria matching and verification tiers — including off-market and auction-sourced assets that never reach the open market.',
  },
  {
    title: 'Not access-on-registration.',
    body: 'Confidential material is gated behind KYC/AML verification, investor classification, NDA acceptance and internal review. That friction is a fiduciary obligation, not a conversion tactic.',
  },
]

const ACCESS_STEPS = [
  {
    step: '01',
    title: 'Register & verify',
    body: 'A lightweight account and an email verification. Nothing confidential is visible yet — by design.',
  },
  {
    step: '02',
    title: 'Classify & profile',
    body: 'Investor classification, personal or organisational details, objectives and capacity. Tension-free questions, honestly optional where the law allows.',
  },
  {
    step: '03',
    title: 'Verify (KYC/AML)',
    body: 'Document submission and checks under applicable requirements. Internal review runs alongside, and you can watch its progress.',
  },
  {
    step: '04',
    title: 'NDA & tier assignment',
    body: 'Confidentiality agreement accepted, then graduated tiers unlock: opportunity financials, off-market briefs, the full data room.',
  },
  {
    step: '05',
    title: 'Work the mandate',
    body: 'Discover, model, order briefs, transact and own — with your advisor desk alongside at every step.',
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

export default async function LandingPage() {
  const [ctx, landing] = await Promise.all([getAuthContext(), getLandingContent()])
  const isAuthenticated = !!ctx

  const hero = {
    eyebrow: landing?.heroEyebrow || 'Murivest Group · Investor Suite · Nairobi | London',
    headline: landing?.heroHeadline || 'See the underwriting before you write the cheque.',
    subline:
      landing?.heroSubline ||
      'A private investment environment for principals, family offices and qualified investors to discover, evaluate and pursue commercial real estate opportunities — with the NOI, downside scenarios and exit assumptions visible before a decision is made.',
  }
  const credibility = landing?.credibility?.length
    ? landing.credibility
    : [
        'East Africa & United Kingdom coverage — Grade A income-producing assets',
        'Fiduciary standards · KYC/AML verified · NDA-gated confidential material',
        'Mandate-only engagements with transparent, documented fee structures',
      ]
  const markets = landing?.coverageMarkets?.length ? landing.coverageMarkets : COMPANY.coverage

  // Director video: Sanity overrides, environment fallbacks, honest empty state otherwise.
  const directorName = landing?.directorName || process.env.NEXT_PUBLIC_DIRECTOR_NAME || ''
  const videoUrl = landing?.directorVideoUrl || process.env.NEXT_PUBLIC_DIRECTOR_VIDEO_URL || ''
  const posterUrl =
    (landing?.directorVideoPosterRef ? getImageAssetUrl(landing.directorVideoPosterRef, 1280) : null) ||
    process.env.NEXT_PUBLIC_DIRECTOR_VIDEO_POSTER ||
    ''
  const videoCaption = landing?.directorVideoCaption || 'Recorded at 4th Avenue Parklands, Nairobi.'

  const signatureName = directorName || 'The Director'

  return (
    <AuthModalProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(faqJsonLd)}} />
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
                      Enter Investor Suite
                    </Link>
                  ) : (
                    <AuthTrigger mode="signin" variant="outline">
                      Client sign-in
                    </AuthTrigger>
                  )}
                </div>
                <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-ivory/45">
                  Verification-gated · No listing feed · Your details are never sold
                </p>
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
                    'Every interaction, document and decision organised within one secure investor environment.',
                    'A private, high-signal environment — no noise, no cold pitch, no marketing churn.',
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

          {/* ================= INVESTOR SUITE SHOWCASE ================= */}
          <section id="investor-suite" className="overflow-hidden border-b border-border bg-[#F6F4EF]">
            <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
              <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.7fr]">
                <div>
                  <div className="eyebrow mb-4">A private digital environment by Murivest</div>
                  <h2 className="font-display max-w-3xl text-3xl leading-tight text-primary sm:text-4xl lg:text-5xl">
                    Introducing <span className="italic text-gold">Investor Suite.</span>
                  </h2>
                </div>
                <p className="max-w-xl text-sm leading-7 text-muted-foreground lg:justify-self-end">
                  A dedicated environment for principals, family offices and qualified investors to review opportunities,
                  examine investment analysis, manage written mandates and keep important client activity in one place.
                </p>
              </div>

              <div className="mt-12 grid overflow-hidden border border-[#DED8CC] bg-[#EEECE6] lg:grid-cols-12">
                <div className="flex flex-col justify-center p-8 sm:p-12 lg:col-span-5 lg:p-14">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-gold" />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-gold">Inside Investor Suite</span>
                  </div>
                  <h3 className="mt-7 font-display text-3xl leading-tight text-primary sm:text-4xl">
                    Your investment relationship, brought together.
                  </h3>
                  <p className="mt-5 text-sm leading-7 text-muted-foreground">
                    Move beyond email threads and disconnected documents. Investor Suite brings opportunity discovery,
                    underwriting tools, mandates, orders, documents and portfolio information into a single private client experience.
                  </p>

                  <div className="mt-8 space-y-5">
                    {[
                      ['Discover', 'Criteria-led access to curated property opportunities.'],
                      ['Investment Studio', 'Model assumptions, financing scenarios and potential exits.'],
                      ['Mandates & Orders', 'Keep instructions, commissioned briefs and progress organised.'],
                      ['Documents & Portfolio', 'Access permitted materials and review your investment activity.'],
                    ].map(([title, description], index) => (
                      <div key={title} className="flex gap-4 border-t border-[#D8D1C5] pt-4">
                        <span className="font-display text-sm text-gold">0{index + 1}</span>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-[0.13em] text-primary">{title}</h4>
                          <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-9 flex flex-wrap gap-3">
                    <Link
                      href={isAuthenticated ? '/portal' : '#access'}
                      className="inline-flex min-h-12 items-center justify-center gap-3 bg-primary px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-ivory transition-colors hover:bg-forest-deep"
                    >
                      {isAuthenticated ? 'Enter Investor Suite' : 'Request private access'}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    {!isAuthenticated && (
                      <AuthTrigger mode="signin" variant="outline">Client sign-in</AuthTrigger>
                    )}
                  </div>
                </div>

                <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-[#E6E2D9] p-6 sm:p-10 lg:col-span-7 lg:min-h-[650px]">
                  <div className="absolute left-1/2 top-1/2 h-[75%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/20" aria-hidden="true" />
                  <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/20" aria-hidden="true" />
                  <div className="relative z-10 w-full max-w-[760px] overflow-hidden rounded-[18px] border border-[#B8B1A5] bg-white shadow-[0_30px_80px_rgba(23,37,29,0.18)]">
                    <div className="flex h-9 items-center gap-1.5 border-b border-[#E8E5DF] bg-[#FAF9F6] px-4">
                      <span className="h-2 w-2 rounded-full bg-[#D6CFC3]" />
                      <span className="h-2 w-2 rounded-full bg-[#D6CFC3]" />
                      <span className="h-2 w-2 rounded-full bg-[#D6CFC3]" />
                      <span className="ml-3 text-[9px] tracking-[0.12em] text-[#8B887F]">INVESTORS.MURIVEST.COM</span>
                    </div>
                    <Image
                      src="/investor-suite.png"
                      alt="Murivest Investor Suite dashboard showing the private investor workspace and its investment modules"
                      width={857}
                      height={592}
                      priority
                      className="block h-auto w-full object-cover object-top"
                      sizes="(max-width: 1024px) 90vw, 760px"
                    />
                  </div>
                  <div className="absolute bottom-5 left-5 border border-[#D5CCBD] bg-[#F8F7F3]/95 px-4 py-3 backdrop-blur-sm sm:bottom-8 sm:left-8">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.25em] text-gold">Murivest Group</p>
                    <p className="mt-1 font-display text-sm text-primary">Investor Suite · Private client access</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col justify-between gap-3 border-t border-[#DED8CC] pt-5 sm:flex-row sm:items-center">
                <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Private access · Permission-based information · Client-specific experience</p>
                <a href="https://investors.murivest.com" className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:text-gold">
                  Visit Investor Suite <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </section>

          {/* ================= THE LETTER ================= */}
          <section id="letter" className="mx-auto max-w-3xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="mb-10 text-center">
              <div className="eyebrow mb-3">Before you read anything else on this page</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">A five-minute letter from the Director.</h2>
            </div>
            <article className="border border-border bg-card p-8 leading-[1.75] text-foreground/90 sm:p-12">
              <p className="font-display text-lg italic text-primary">To a principal managing serious capital,</p>

              <p className="mt-7 text-[15px]">
                If you already invest through large managers, you know the ritual. The glossy fund deck. The
                hockey-stick projection. The fee schedule that begins at two-and-twenty. And the one sentence that
                ends most meetings: <em>&ldquo;the underwriting is proprietary.&rdquo;</em>
              </p>

              <p className="mt-6 text-[15px]">
                So let me ask the question a careful principal should ask before issuing a mandate: when you
                write that cheque, <strong className="text-primary">what exactly are you buying?</strong>
              </p>

              <p className="mt-6 text-[15px]">
                Because here is what happens when nobody asks it. You get exposure to a market — but not control
                of an asset. You get a projected return — but not the assumptions underneath it, or the stress case
                behind it. You get a manager&rsquo;s confidence — and you keep the risk. In a pooled structure that
                trade is priced in fees you pay every year, whether the thesis works or not.
              </p>

              <p className="mt-6 text-[15px]">
                We built Murivest differently, and Investor Suite is the digital expression of that approach. {COMPANY.legalName} is
                an international commercial real estate services and investment firm — principal offices in Nairobi
                and London, Grade A income-producing assets, fiduciary standards, KYC/AML verified. We do not pool
                capital. We do not operate collective investment schemes. Every engagement is direct, non-pooled
                and mandate-only: your capital, your name on the deed, your underwriting — on your side of the
                table.
              </p>

              <p className="mt-6 text-[15px]">
                Investor Suite is designed to answer six questions we believe you should never have to ask twice: what
                exclusive or better-structured opportunities exist right now; can I see institutional underwriting
                and stress tests before I commit; can I model capital structure, leverage and exits myself; can I
                order a deep institutional brief — and pay for it — in minutes; is every interaction, document and
                decision tracked in one secure workspace; and will this stay private, high-signal and noise-free.
                You will find those six answers just below this letter.
              </p>

              <p className="mt-6 text-[15px]">
                I recorded a short video — my face, my voice, in our own offices — because in this business trust
                is earned in person, not in a headline. Watch it, download the manual, take your time. Then, if the
                standard matches yours — or the standard you want to hold — request access. Where you go from
                there is entirely your decision. That is rather the point.
              </p>

              <div className="gold-rule mt-10" />
              <div className="mt-8 flex flex-col gap-1.5">
                <span className="font-display text-2xl italic text-primary">{signatureName}</span>
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Director, {COMPANY.legalName}
                </span>
                <span className="text-xs text-muted-foreground">Nairobi · London · {COMPANY.email} · {COMPANY.phone}</span>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#video"
                  className="inline-flex items-center gap-2 border border-gold/40 bg-gold/5 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  <Play className="h-4 w-4" /> Watch the video below
                </a>
                <a
                  href={MANUAL_PATH}
                  className="inline-flex items-center gap-2 border border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  <BookOpen className="h-4 w-4" /> Download the Investor Suite manual (PDF)
                </a>
              </div>
            </article>
          </section>

          {/* ================= DIRECTOR VIDEO ================= */}
          <section id="video" className="border-y border-border bg-secondary/40">
            <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
              <div className="mb-12 max-w-2xl">
                <div className="eyebrow mb-3">The face behind the desk</div>
                <h2 className="font-display text-3xl text-primary lg:text-4xl">
                  Meet the Director — four minutes, no headline-chasing.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  The letter above is written. This is spoken. Watch it the way you would size up a counterparty
                  across a boardroom table — then judge Investor Suite on what it does, not what it says.
                </p>
              </div>

              <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
                <figure className="m-0">
                  <div className="border border-gold/30 bg-forest-deep">
                    {videoUrl ? (
                      <video controls preload="metadata" playsInline poster={posterUrl || undefined} className="aspect-video w-full">
                        <source src={videoUrl} />
                        Your browser cannot play embedded video. The word-for-word script is downloadable below.
                      </video>
                    ) : (
                      <div className="flex aspect-video w-full flex-col items-center justify-center gap-5 px-8 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 text-gold">
                          <Play className="h-6 w-6" />
                        </div>
                        <p className="max-w-md text-sm leading-relaxed text-ivory/70">
                          The Director&rsquo;s introduction video is being published. Until the camera work is
                          finished, the word-for-word production script is available now — review exactly what
                          will be said, and hold us to it.
                        </p>
                        <a
                          href={SCRIPT_PATH}
                          className="inline-flex items-center gap-2 border border-gold/50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold hover:text-forest-deep"
                        >
                          <Download className="h-4 w-4" /> Read the word-for-word script
                        </a>
                      </div>
                    )}
                  </div>
                  <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{videoCaption}</span>
                    <span>
                      {directorName ? `${directorName} · ` : ''}Director, {COMPANY.legalName}
                    </span>
                  </figcaption>
                </figure>

                <div className="flex flex-col justify-center">
                  <div className="eyebrow mb-4">What you will hear in this video</div>
                  <ol className="space-y-6">
                    {[
                      'Who Murivest is — and what it refuses to be: a pooled fund, a listing site, a pressure desk.',
                      'How Investor Suite actually works: verification, discovery, underwriting, modelling, ordering, closing.',
                      'The honest limits of what we do — and the safeguards behind them: KYC/AML, NDA, watermarked documents, audit trails.',
                    ].map((item, i) => (
                      <li key={item.slice(0, 20)} className="flex gap-4">
                        <span className="font-display text-2xl leading-none text-gold/70">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="gold-rule my-8" />
                  <div className="flex flex-col gap-3">
                    <a
                      href={SCRIPT_PATH}
                      className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:text-gold"
                    >
                      <Download className="h-4 w-4 text-gold" /> Word-for-word video script (Markdown)
                    </a>
                    <a
                      href={MANUAL_PATH}
                      className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:text-gold"
                    >
                      <BookOpen className="h-4 w-4 text-gold" /> Step-by-step Investor Suite manual (PDF)
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= SIX ANSWERS ================= */}
          <section id="platform" className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="mb-12 max-w-2xl">
              <div className="eyebrow mb-3">Investor Suite</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">
                Six questions a serious principal asks. Twelve modules that answer them.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                One confidential Investor Suite environment — Discover, Investment Studio, Compare, Orders, My Investments,
                Mandates, Documents, Market Intelligence, Activity, Profile, Security — designed for investors who
                deploy eight-to-nine-figure sums into income-producing commercial assets.
              </p>
            </div>
            <div className="grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              {SIX_ANSWERS.map((vp) => (
                <article key={vp.question} className="bg-card p-8">
                  <vp.icon className="mb-5 h-7 w-7 text-gold" strokeWidth={1.5} />
                  <h3 className="font-display text-lg leading-snug text-primary">{vp.question}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{vp.answer}</p>
                  <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/80">
                    {vp.module}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ================= WHAT MURIVEST IS NOT ================= */}
          <section id="standard" className="bg-primary text-ivory">
            <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
              <div className="mb-12 max-w-2xl">
                <div className="eyebrow mb-3 !text-gold/80">Read this before you request access</div>
                <h2 className="font-display text-3xl text-ivory lg:text-4xl">
                  What Murivest is not — in plain words.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-ivory/70">
                  Trust in private capital is built as much on refusals as on promises. These three are structural,
                  not aspirational — they describe how the firm is organised, not how it hopes to behave.
                </p>
              </div>
              <div className="grid gap-px border border-ivory/15 bg-ivory/15 md:grid-cols-3">
                {NOT_STATEMENTS.map((n) => (
                  <article key={n.title} className="bg-primary p-8">
                    <XCircle className="mb-5 h-7 w-7 text-gold" strokeWidth={1.5} />
                    <h3 className="font-display text-xl text-ivory">{n.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ivory/70">{n.body}</p>
                  </article>
                ))}
              </div>
              <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <h3 className="font-display text-2xl text-ivory">The basis of every engagement</h3>
                  <p className="mt-4 max-w-lg text-sm leading-relaxed text-ivory/70">{COMPANY.description}</p>
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
            </div>
          </section>

          {/* ================= GRADUATED ACCESS + AUDIENCES ================= */}
          <section id="access" className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="mb-12 max-w-2xl">
              <div className="eyebrow mb-3">The velvet rope</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">
                How access actually works — and why the friction protects you.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Registration opens a lightweight account. Confidential material unlocks only through
                verification, classification, NDA acceptance and internal review — graduated tiers, never
                all-at-once. Access is never granted on registration alone.
              </p>
            </div>
            <ol className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
              {ACCESS_STEPS.map((p) => (
                <li key={p.step} className="bg-card p-6">
                  <div className="tabular font-display text-3xl text-gold/70">{p.step}</div>
                  <h3 className="mt-3 text-sm font-semibold text-primary">{p.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 border-l-2 border-gold/50 pl-4 text-xs italic leading-relaxed text-muted-foreground">
              Confidential materials are never accessible on registration alone. That is not a conversion tactic —
              it is a fiduciary obligation to the counterparties on the other side of every off-market opportunity.
            </p>

            <div className="mt-16 mb-10 max-w-2xl">
              <div className="eyebrow mb-3">Built for</div>
              <h2 className="font-display text-2xl text-primary lg:text-3xl">Serious capital, verified counterparties.</h2>
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
          </section>

          {/* ================= COVERAGE ================= */}
          <section id="coverage" className="border-y border-border bg-secondary/40">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_1.2fr] lg:px-10">
              <div>
                <div className="eyebrow mb-3">Coverage</div>
                <h2 className="font-display text-2xl text-primary lg:text-3xl">East Africa roots. London desk. International reach.</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Principal offices in Nairobi and London, operating across the principal commercial sectors —
                  office, industrial, retail, hospitality, mixed-use and land.
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

          {/* ================= FAQ ================= */}
          <section id="faq" className="mx-auto max-w-3xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="mb-12 text-center">
              <div className="eyebrow mb-3">Objection handling</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">Questions we would ask if we were you.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Raised here deliberately — before you raise them. If an answer here is thinner than you would
                like, that is exactly the kind of thing to press on in your first conversation with the desk.
              </p>
            </div>
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

          {/* ================= CTA + P.S. ================= */}
          <section id="contact" className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-24">
            <div className="border border-gold/40 bg-gold/5 p-10 text-center lg:p-16">
              <div className="eyebrow mb-4">Private access</div>
              <h2 className="font-display text-3xl text-primary lg:text-4xl">Your capital deserves a quieter room.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Request access, complete verification, and begin allocating — with your Murivest advisor alongside
                at every step.
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

            <div className="mt-8 border border-border bg-card p-8 text-left sm:p-10">
              <div className="font-display text-lg italic text-primary">P.S. — not ready to request access yet?</div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Take the manual instead. It walks through every module of Investor Suite — how to discover, underwrite,
                model, order, mandate and close — step by step, before you share anything with us. If you would
                rather hear it in person first, the Director&rsquo;s word-for-word video script is here too. No
                form, no email required, no follow-up.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <a
                  href={MANUAL_PATH}
                  className="inline-flex items-center gap-2 border border-gold/40 bg-gold/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  <BookOpen className="h-4 w-4 text-gold" /> Download the Investor Suite manual (PDF)
                </a>
                <a
                  href={SCRIPT_PATH}
                  className="inline-flex items-center gap-2 border border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  <Download className="h-4 w-4 text-gold" /> Director&rsquo;s video script (Markdown)
                </a>
              </div>
            </div>
          </section>
        </main>

        {/* ================= FOOTER ================= */}
        <footer className="mt-auto border-t border-border bg-forest-deep text-ivory">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-10">
            <div>
              <div className="font-display text-lg font-semibold tracking-[0.08em] text-ivory">MURIVEST</div>
              <div className="gold-rule mt-2 w-10" />
              <p className="mt-4 text-xs leading-relaxed text-ivory/50">
                {COMPANY.legalName} — international commercial real estate services and investment firm. Grade A
                income-producing assets, on a direct, non-pooled, mandate-only basis.
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
              <div className="eyebrow mb-3 !text-gold/70">Resources</div>
              <p>
                <Link href="/differential-underwriting" className="text-ivory/80 transition-colors hover:text-gold">
                  Differential Underwriting — the method
                </Link>
              </p>
              <p>
                <Link href="/underwriting-calculator" className="text-ivory/80 transition-colors hover:text-gold">
                  Underwriting calculator
                </Link>
              </p>
              <p>
                <Link href="/insights" className="text-ivory/80 transition-colors hover:text-gold">
                  Insights — billionaire playbooks &amp; desk research
                </Link>
              </p>
              <p>
                <Link href="/billionaire-real-estate" className="text-ivory/80 transition-colors hover:text-gold">
                  The UHNW desk
                </Link>
              </p>
              <p>
                <a href={MANUAL_PATH} className="text-ivory/80 transition-colors hover:text-gold">
                  Investor Suite manual (PDF)
                </a>
              </p>
              <p>
                <a href={SCRIPT_PATH} className="text-ivory/80 transition-colors hover:text-gold">
                  Director&rsquo;s video script (MD)
                </a>
              </p>
              <p>
                <a href={COMPANY.auctionsUrl} target="_blank" rel="noreferrer noopener" className="text-ivory/80 transition-colors hover:text-gold">
                  auctions.murivest.com
                </a>
              </p>
            </div>
            <div className="text-xs leading-relaxed text-ivory/60">
              <div className="eyebrow mb-3 !text-gold/70">Notice</div>
              <p className="text-ivory/45">
                Confidential Investor Suite environment. Murivest does not pool capital or operate collective investment schemes.
                All engagements proceed under fiduciary standards, applicable KYC/AML requirements and formal scope
                documentation. Communications may be monitored for security purposes under applicable law.
              </p>
            </div>
          </div>
          <div className="border-t border-ivory/10">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-[10px] uppercase tracking-[0.18em] text-ivory/40 sm:flex-row sm:items-center sm:justify-between lg:px-10">
              <span>© {new Date().getFullYear()} {COMPANY.legalName} · Strictly confidential</span>
              <span>Private commercial real estate · Off-market · Family offices · Mandate-only</span>
            </div>
          </div>
        </footer>
      </div>
    </AuthModalProvider>
  )
}
