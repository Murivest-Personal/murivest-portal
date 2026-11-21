import type {Metadata} from 'next'
import Link from 'next/link'
import {ArrowRight, CheckCircle2, ListOrdered, Scale, ShieldCheck, XCircle} from 'lucide-react'
import {AUTHOR} from '@/components/content/insights'
import {COMPANY} from '@/lib/constants'
import LandingHeader from '@/components/marketing/LandingHeader'
import {AuthModalProvider} from '@/components/marketing/AuthModalProvider'

export const metadata: Metadata = {
  title: 'Differential Underwriting — The Murivest Method for Commercial Real Estate',
  description:
    'Rank the competing explanations of a deal\u2019s value. Test the assumptions that move the answer. Rule out the stories that fail. Price the spread between consensus and reality. The house method of Mark Muriithi, Managing Director & Differential Underwriter at Murivest Group.',
  keywords: [
    'differential underwriting',
    'commercial real estate underwriting',
    'CRE underwriting method',
    'investment analysis method',
    'property valuation discipline',
    'Murivest Group',
    'Mark Muriithi',
  ],
  alternates: {canonical: '/differential-underwriting'},
  openGraph: {
    title: 'Differential Underwriting — Diagnose Before You Dollar',
    description:
      'The Murivest house method: a deal is not one pro forma but a ranked set of competing explanations of value, tested against evidence, priced as a spread against consensus.',
    type: 'website',
  },
  robots: {index: true, follow: true},
}

const FAQ_ITEMS = [
  {
    q: 'What is Differential Underwriting?',
    a: 'A commercial real estate underwriting method that treats a deal\u2019s price and narrative as a claim, ranks the competing explanations of its value and risk (rent, credit, capital expenditure, financing, exit), tests the assumptions that actually move the answer, rules out the explanations that fail on evidence, and prices the spread between the market\u2019s story and the asset\u2019s reality. The output is a defensible verdict with a known error band — not a single confident pro forma.',
  },
  {
    q: 'Who runs the method?',
    a: 'Differential Underwriting is the house method of Murivest Group Ltd, originated and led by Mark Muriithi, Managing Director and the desk\u2019s Differential Underwriter. Every mandate the firm executes passes the same seven-stage protocol, and every deliverable closes with a Differential Verdict that an investment committee can inspect — hypothesis register, rule-out log and offer ladder included.',
  },
  {
    q: 'How is this different from a normal underwrite?',
    a: 'A conventional underwrite produces one pro forma and negotiates around it. The differential produces a ranked register of competing explanations written before modelling begins, builds the model to discriminate between them, expresses the conclusion as a value band rather than a point, and fixes the offer ladder — opening offer, target zone, hard walk-away — before the negotiation starts.',
  },
  {
    q: 'Can I run a differential underwrite on my own property?',
    a: 'Yes. The public engine on this site computes the core of the method — the three competing explanations of value, the offer ladder, DSCR-based maximum loan, and rent guidance — from your property\u2019s location, income, lease, owner and building specifics. The mandate-grade version adds the evidence layer: rent roll reconciliation, estoppels, title, and the capex register.',
  },
]

const PROTOCOL = [
  ['1 · Presenting asset', 'What is being presented — asking price, reported income, occupancy, the seller\u2019s narrative?', 'Deal fact sheet'],
  ['2 · Initial read', 'What does conventional underwriting suggest about the property?', 'Consensus case'],
  ['3 · Differential hypotheses', 'What alternative explanations exist for its performance, valuation, vacancy or pricing?', 'Ranked hypothesis register'],
  ['4 · Investigative testing', 'Do leases, title, comparables, expenses, capex and location support or destroy each hypothesis?', 'Evidence file'],
  ['5 · Rule-out analysis', 'Which assumptions, liabilities and projections are unsupported?', 'Rule-out log'],
  ['6 · Final underwriting', 'What is the defensible NOI, basis, yield, downside exposure and exit?', 'Differential valuation'],
  ['7 · Investment verdict', 'Acquire, renegotiate, restructure, monitor or reject?', 'Differential Verdict memo'],
]

const TERMINOLOGY = [
  ['Differential Underwriting', 'The method — public identity', 'Engagement letters, mandate documents, pitch headlines'],
  ['Differential Analysis', 'The research methodology', 'Research notes, market commentary, desk memos'],
  ['Differential Investigation', 'The diligence discipline', 'Diligence reports, data-room indices, checklist headers'],
  ['Differential Valuation', 'The valuation output', 'Valuation sections of investment memoranda'],
  ['Differential Intelligence', 'Proprietary research', 'Intelligence beyond public property information'],
  ['Differential Verdict', 'The investment conclusion', 'The closing recommendation of every deal memo'],
]

export default function DifferentialUnderwritingPage() {
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
                The Murivest method
              </div>
              <h1 className="font-display text-4xl leading-[1.1] sm:text-5xl lg:text-[3.2rem]">
                Differential Underwriting.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-ivory/70 sm:text-lg">
                I rank the risks, test the assumptions, rule out the bad stories, and underwrite the gap between
                consensus and reality. The asking price is a claim, not a valuation — and a deal is not one pro forma
                but a set of competing explanations of value, of which only one survives the evidence.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/underwriting-calculator"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-forest-deep transition-colors hover:bg-gold-deep hover:text-ivory"
                >
                  Run the engine on your property <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/insights/differential-underwriting-explained"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-ivory/40 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ivory transition-colors hover:border-gold hover:text-gold"
                >
                  The full explainer
                </Link>
              </div>
              <div className="mt-12 grid gap-4 border-t border-ivory/15 pt-8 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ivory/45">Identity</div>
                  <div className="mt-1.5 text-sm font-semibold text-ivory">Differential Underwriting</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ivory/45">Method</div>
                  <div className="mt-1.5 text-sm font-semibold text-ivory">Differential Analysis</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ivory/45">Conclusion</div>
                  <div className="mt-1.5 text-sm font-semibold text-ivory">The Differential Verdict</div>
                </div>
              </div>
            </div>
          </section>

          {/* ============== PRINCIPLES ============== */}
          <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
            <div className="eyebrow mb-4">First principles</div>
            <h2 className="max-w-2xl font-display text-3xl leading-snug text-primary">
              The method is a discipline, not a delay mechanism.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  <CheckCircle2 className="h-4 w-4 text-gold" /> What it is
                </div>
                <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-foreground/80">
                  <li className="flex items-start gap-2.5"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" />A hypothesis-driven investigation of value.</li>
                  <li className="flex items-start gap-2.5"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" />A rule-out procedure for bad assumptions.</li>
                  <li className="flex items-start gap-2.5"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" />A pricing discipline that treats the asking price as a claim to be tested.</li>
                  <li className="flex items-start gap-2.5"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" />A bridge between market evidence and asset-specific truth.</li>
                </ul>
              </div>
              <div className="rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  <XCircle className="h-4 w-4 text-destructive/70" /> What it is not
                </div>
                <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-foreground/80">
                  <li className="flex items-start gap-2.5"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" />A search for reasons to decline every deal.</li>
                  <li className="flex items-start gap-2.5"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" />A substitute for market knowledge.</li>
                  <li className="flex items-start gap-2.5"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" />A modelling exercise detached from physical and legal diligence.</li>
                  <li className="flex items-start gap-2.5"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-gold" />A delay mechanism — a differential that never converges on a verdict is a failed differential.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ============== PROTOCOL ============== */}
          <section className="surface-band border-y border-border">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
              <div className="eyebrow mb-4">The seven stages</div>
              <h2 className="max-w-2xl font-display text-3xl leading-snug text-primary">
                Every file passes the same protocol.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                The protocol is fixed; the depth at each stage scales with deal size. Stage 3 is the heart of the
                method — and the stage conventional underwriting skips: the hypothesis register is written before
                modelling begins, so the model discriminates between explanations rather than decorating one of them.
              </p>
              <div className="mt-10 overflow-x-auto rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Stage</th>
                      <th className="px-3 py-3 font-medium">The question asked</th>
                      <th className="px-5 py-3 font-medium">The output</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {PROTOCOL.map(([stage, question, output]) => (
                      <tr key={stage} className="border-b border-border/60 last:border-b-0">
                        <td className="px-5 py-3.5 font-medium text-primary">{stage}</td>
                        <td className="px-3 py-3.5 leading-6 text-foreground/80">{question}</td>
                        <td className="px-5 py-3.5 leading-6 text-muted-foreground">{output}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ============== THE SPREAD ============== */}
          <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <div className="eyebrow mb-4">The product</div>
                <h2 className="font-display text-3xl leading-snug text-primary">
                  The spread is the product.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Three competing explanations of value sit inside every deal: the seller&rsquo;s story (fully let, lean
                  costs, the market cap rate), the in-place reality (today&rsquo;s occupancy, today&rsquo;s costs), and the
                  stabilised case net of the re-leasing programme. The differential underwriter prices all three,
                  keeps the defensible one, and negotiates the band — never the brochure.
                </p>
                <ul className="mt-6 grid gap-3 text-sm leading-relaxed text-foreground/80">
                  <li className="flex items-start gap-2.5"><Scale className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />The differential spread — consensus value minus underwritten value — goes on the front page of every verdict memo.</li>
                  <li className="flex items-start gap-2.5"><ListOrdered className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />Every verdict is an offer ladder: opening offer, target zone, hard walk-away — anchored in basis points of defensible yield.</li>
                  <li className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />Debt is sized from income downward — a DSCR floor converts into a maximum supportable loan before any price is discussed.</li>
                </ul>
              </div>
              <div className="rounded-[16px] bg-forest-deep p-7 text-ivory shadow-[var(--shadow-card)]">
                <div className="text-[10px] uppercase tracking-[0.18em] text-gold/80">Worked example — illustrative</div>
                <p className="mt-4 font-display text-xl italic leading-relaxed">
                  &ldquo;A 49,000 sq ft CBD tower asks 800M at 40% occupancy. The seller&rsquo;s story values it at
                  802.7M. Today&rsquo;s reality: 252.3M. The stabilised case, net of the re-leasing programme: 566.2M.
                  The spread — 233.8M, or 29.2% of asking — is the entire reason the file is worth a desk&rsquo;s time.&rdquo;
                </p>
                <div className="gold-rule mt-6 w-12" aria-hidden="true" />
                <p className="mt-4 text-xs leading-relaxed text-ivory/60">
                  From the desk&rsquo;s published reference case. All assumptions flagged illustrative pending the data
                  room — the verdict is re-run on evidence alone.
                </p>
                <Link
                  href="/insights/nairobi-cbd-office-underwriting"
                  className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold transition-colors hover:text-ivory"
                >
                  Read the full walk-through <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>

          {/* ============== TERMINOLOGY ============== */}
          <section className="surface-band border-y border-border">
            <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
              <div className="eyebrow mb-4">The terminology hierarchy</div>
              <h2 className="max-w-2xl font-display text-3xl leading-snug text-primary">
                A signature becomes a signature through restraint.
              </h2>
              <div className="mt-10 overflow-x-auto rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Term</th>
                      <th className="px-3 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Where it appears</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {TERMINOLOGY.map(([term, role, where]) => (
                      <tr key={term} className="border-b border-border/60 last:border-b-0">
                        <td className="px-5 py-3.5 font-medium text-primary">{term}</td>
                        <td className="px-3 py-3.5 leading-6 text-foreground/80">{role}</td>
                        <td className="px-5 py-3.5 leading-6 text-muted-foreground">{where}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ============== MD ============== */}
          <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-[16px] border border-gold/40 bg-gold/5 p-7 sm:p-9">
                <div className="eyebrow">The desk</div>
                <h2 className="mt-3 font-display text-2xl leading-snug text-primary">{AUTHOR.name}</h2>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{AUTHOR.role}</div>
                <div className="gold-rule mt-4 w-12" aria-hidden="true" />
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{AUTHOR.bio}</p>
                <p className="mt-5 font-display text-lg italic leading-relaxed text-primary">
                  &ldquo;Diagnose before you dollar.&rdquo;
                </p>
              </div>
              <div className="flex flex-col justify-center rounded-[16px] border border-border bg-card p-7 shadow-[var(--shadow-card)] sm:p-9">
                <div className="eyebrow">Run it yourself</div>
                <h3 className="mt-3 font-display text-2xl leading-snug text-primary">
                  The engine is public. The evidence is the mandate.
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Enter your property&rsquo;s location, income, lease, owner and building specifics — the engine returns
                  the three explanations of value, the offer ladder, the maximum loan and the rent guidance. When the
                  arithmetic says the deal deserves it, request private access and the desk runs the full protocol on
                  evidence: the fourteen-document data room, the rule-outs, and the Differential Verdict.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/underwriting-calculator"
                    className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep"
                  >
                    Open the engine <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/?auth=required"
                    className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-border px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                  >
                    Request private access
                  </Link>
                </div>
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
              <Link href="/underwriting-calculator" className="transition-colors hover:text-gold">Calculator</Link>
              <Link href="/insights" className="transition-colors hover:text-gold">Insights</Link>
              <Link href="/billionaire-real-estate" className="transition-colors hover:text-gold">UHNW desk</Link>
            </span>
          </div>
        </footer>
      </div>
    </AuthModalProvider>
  )
}
