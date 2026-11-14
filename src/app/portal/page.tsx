import type {Metadata} from 'next'
import Link from 'next/link'
import {db} from '@/lib/db'
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Briefcase,
  Calculator,
  ClipboardList,
  Eye,
  FileStack,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {requirePortalUser, classificationLabel, tierLabel} from '@/lib/auth/context'
import {getOpportunities} from '@/lib/sanity/queries'
import {getCriteria} from '@/lib/portal/data'
import {matchOpportunity} from '@/lib/portal/matching'
import {fmtMoney, fmtDate, relativeTime, humanizeStatus} from '@/lib/format'
import {Metric, StatusBadge, EmptyState, SectionHeading} from '@/components/brand/primitives'
import OpportunityCard from '@/components/portal/OpportunityCard'
import {isSanityConfigured} from '@/lib/sanity/client'

export const metadata: Metadata = {
  title: 'Overview',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function PortalOverviewPage() {
  const ctx = await requirePortalUser()
  const uid = ctx.user.id

  const [criteria, savedIds, recentViews, orders, mandates, scenarios, positions, docRequests, unreadNotifications, latestEnquiries, advisor] =
    await Promise.all([
      getCriteria(uid),
      db.savedOpportunity.findMany({where: {userId: uid}, select: {sanityId: true}}).then((rows) => new Set(rows.map((r) => r.sanityId))),
      db.opportunityView.findMany({where: {userId: uid}, orderBy: {viewedAt: 'desc'}, take: 5, select: {sanityId: true, viewedAt: true}}),
      db.order.findMany({where: {userId: uid}, orderBy: {createdAt: 'desc'}, take: 5}),
      db.mandate.findMany({where: {userId: uid}, orderBy: {updatedAt: 'desc'}, take: 4}),
      db.scenario.findMany({where: {userId: uid}, orderBy: {updatedAt: 'desc'}, take: 4}),
      db.portfolioPosition.findMany({where: {userId: uid}, take: 12}),
      db.documentRequest.findMany({where: {userId: uid}, orderBy: {createdAt: 'desc'}, take: 3}),
      db.notification.count({where: {userId: uid, readAt: null}}),
      db.enquiry.findMany({where: {userId: uid}, orderBy: {updatedAt: 'desc'}, take: 3}),
      ctx.profile?.advisorId ? db.user.findUnique({where: {id: ctx.profile.advisorId}, select: {fullName: true, email: true}}) : Promise.resolve(null),
    ])

  // Recommended opportunities (permission-filtered, criteria-scored)
  const opportunities = await getOpportunities(ctx.effectiveTier)
  const scored = opportunities
    .map((o) => ({o, match: matchOpportunity(o, criteria)}))
    .filter(({o}) => !savedIds.has(o._id))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 3)

  // View counts for "high interest" signal
  const viewCounts = new Map<string, number>()
  const grouped = await db.opportunityView.groupBy({by: ['sanityId'], _count: {_all: true}})
  for (const g of grouped) viewCounts.set(g.sanityId, g._count._all)

  const savedOpportunities = opportunities.filter((o) => savedIds.has(o._id)).slice(0, 3)
  const recentOpportunityIds = recentViews.map((v) => v.sanityId)

  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status))
  const activeMandates = mandates.filter((m) => !['draft'].includes(m.status))
  const capitalCallsDue = await db.capitalCall.findMany({
    where: {position: {userId: uid}, status: {in: ['scheduled', 'called']}},
    include: {position: true},
    orderBy: {dueDate: 'asc'},
    take: 3,
  })

  const verificationSteps = [
    {label: 'Email verified', done: !!ctx.user.emailVerifiedAt},
    {label: 'Investor classification', done: !!ctx.profile && ctx.profile.onboardingStep >= 1},
    {label: 'Profile submitted', done: ['profile_submitted', 'kyc_pending', 'in_review', 'verified'].includes(ctx.profile?.verificationStatus || '')},
    {label: 'KYC / AML review', done: ['in_review', 'verified'].includes(ctx.profile?.verificationStatus || '')},
    {label: 'NDA acceptance', done: !!ctx.profile?.ndaAccepted},
    {label: 'Tier assignment', done: (ctx.profile?.accessTier || 'tier_1') !== 'tier_1' || (ctx.profile?.verificationStatus || '') === 'verified'},
  ]

  const currency = ctx.profile?.capitalCurrency || 'USD'
  const equityAvailable = ctx.profile?.equityAvailable ?? null

  return (
    <div className="space-y-10">
      {/* ============ Command header ============ */}
      <section className="border border-border bg-card p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow mb-2">Investor workspace</div>
            <h1 className="font-display text-3xl text-primary">{ctx.user.fullName || 'Your workspace'}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{classificationLabel(ctx.profile)}</span>
              <span className="text-gold">·</span>
              <span>{tierLabel(ctx.effectiveTier)}</span>
              {advisor ? (
                <>
                  <span className="text-gold">·</span>
                  <span>Advisor: {advisor.fullName || advisor.email}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-xl">
            {equityAvailable != null ? (
              <Metric label="Equity available" value={fmtMoney(equityAvailable, currency, {compact: true})} tone="gold" />
            ) : (
              <Metric label="Equity available" value="Not stated" tone="gold" />
            )}
            <Metric label="Saved opportunities" value={String(savedIds.size)} sub="in your pipeline" />
            <Metric label="Active orders" value={String(activeOrders.length)} sub="briefs in motion" />
            <Metric label="Unread signals" value={String(unreadNotifications)} sub="notifications" />
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-6">
          {[
            {href: '/portal/discover', label: 'Discover opportunities', icon: Eye},
            {href: '/portal/studio', label: 'Start a scenario', icon: Calculator},
            {href: '/portal/orders', label: 'Request a brief', icon: BookOpenCheck},
            {href: '/portal/mandates', label: 'Submit a mandate', icon: ScrollText},
            {href: '/portal/activity', label: 'Message advisor', icon: MessagesSquare},
          ].map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:border-gold hover:text-gold"
            >
              <a.icon className="h-3.5 w-3.5 text-gold/80" />
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ============ Verification & gating ============ */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-primary">Verification & access</h2>
            <StatusBadge status={ctx.profile?.verificationStatus || 'unverified'} />
          </div>
          <ol className="space-y-3">
            {verificationSteps.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <span className={`inline-flex h-5 w-5 items-center justify-center border ${s.done ? 'border-gold bg-gold/15 text-primary' : 'border-border text-muted-foreground/50'}`}>
                  {s.done ? <BadgeCheck className="h-3.5 w-3.5 text-gold" /> : null}
                </span>
                <span className={s.done ? 'text-primary' : 'text-muted-foreground'}>{s.label}</span>
              </li>
            ))}
          </ol>
          {!ctx.profile?.ndaAccepted ? (
            <div className="mt-5 border border-gold/40 bg-gold/5 p-4">
              <p className="text-xs leading-relaxed text-primary">
                <ShieldCheck className="mr-2 inline h-4 w-4 text-gold" />
                Accept the confidentiality agreement to unlock confidential tiers of opportunities, briefs and data-room material.
              </p>
              <Link href="/portal/documents?nda=1" className="mt-3 inline-flex items-center gap-2 border border-gold px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary hover:bg-gold/10">
                Review the NDA <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
          {!ctx.onboardingComplete ? (
            <Link href="/portal/onboarding" className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-gold hover:underline">
              Complete onboarding <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>

        <div className="min-w-0 border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl text-primary">Active criteria</h2>
          {criteria ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="eyebrow mb-1">Equity</dt>
                <dd className="tabular text-primary">{criteria.equityAvailable != null ? fmtMoney(criteria.equityAvailable, criteria.currency, {compact: true}) : '—'}</dd>
              </div>
              <div>
                <dt className="eyebrow mb-1">Target net yield</dt>
                <dd className="tabular text-primary">{criteria.minNetYield != null ? `${criteria.minNetYield}%+` : '—'}</dd>
              </div>
              <div>
                <dt className="eyebrow mb-1">Asset classes</dt>
                <dd className="text-primary">{(criteria.assetClasses || []).length || '—'}</dd>
              </div>
              <div>
                <dt className="eyebrow mb-1">Hold period</dt>
                <dd className="text-primary">{criteria.holdPeriodMin != null || criteria.holdPeriodMax != null ? `${criteria.holdPeriodMin ?? '–'}–${criteria.holdPeriodMax ?? '+'} yrs` : '—'}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState
              icon={Calculator}
              title="No criteria on file"
              body="Capture your investment criteria once and Discover, matching and mandate pre-fills all reuse it."
              action={
                <Link href="/portal/studio?tab=criteria" className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep">
                  Set criteria <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
          )}
        </div>
      </section>

      {/* ============ Recommended opportunities ============ */}
      <section>
        <SectionHeading
          eyebrow="High-signal"
          title="Recommended for your criteria"
          description="Permission-filtered and scored against your stated criteria. Matching is transparent — every card explains itself."
          className="flex flex-wrap items-end justify-between gap-4 [&>div]:mb-0"
        />
        {!isSanityConfigured() ? (
          <EmptyState
            icon={FileStack}
            title="Opportunity intelligence awaits publication"
            body="Murivest publishes opportunities through the content studio. When the first listings go live, this surface fills automatically with tier-filtered, criteria-matched assets — no generic inventory is ever shown."
          />
        ) : scored.length === 0 ? (
          <EmptyState
            icon={Eye}
            title="No recommendations yet"
            body={
              opportunities.length === 0
                ? 'No opportunities are currently published at your access tier. Your advisor will notify you as new inventory clears verification.'
                : 'Nothing matches your criteria right now. Adjust them in the Investment Studio, or save a search with alerts to be first to know.'
            }
            action={
              <Link href="/portal/studio?tab=criteria" className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                Refine criteria
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {scored.map(({o, match}) => (
              <OpportunityCard
                key={o._id}
                opportunity={o}
                saved={false}
                matchedTags={match.reasons.slice(0, 2)}
                viewCount={viewCounts.get(o._id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ============ Pipeline in motion ============ */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Orders */}
        <div className="min-w-0 border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg text-primary">Orders</h3>
            <Link href="/portal/orders" className="text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
              All
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              No briefs ordered yet. Institutional briefs for specific opportunities, auction assets or custom underwriting packages are available on request.
            </p>
          ) : (
            <ul className="space-y-3">
              {orders.slice(0, 4).map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-primary">{o.briefTitle}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {o.reference} · {relativeTime(o.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mandates */}
        <div className="min-w-0 border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg text-primary">Mandates</h3>
            <Link href="/portal/mandates" className="text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
              All
            </Link>
          </div>
          {mandates.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Define an acquisition mandate — size, markets, structures, return targets — and Murivest sources against it on your behalf.
            </p>
          ) : (
            <ul className="space-y-3">
              {mandates.slice(0, 4).map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-primary">{m.title}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{m.reference}</div>
                  </div>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming actions */}
        <div className="min-w-0 border border-border bg-card p-6">
          <h3 className="mb-4 font-display text-lg text-primary">Upcoming & outstanding</h3>
          <ul className="space-y-3 text-sm">
            {capitalCallsDue.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="font-medium text-primary">{c.label}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Capital call · {c.position.name} {c.dueDate ? `· due ${fmtDate(c.dueDate)}` : ''}
                  </div>
                </div>
                <span className="tabular text-xs text-primary">{fmtMoney(c.amount, c.currency, {compact: true})}</span>
              </li>
            ))}
            {docRequests.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="font-medium text-primary">{r.subject}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Document request</div>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
            {activeOrders.map((o) => (
              <li key={`act-${o.id}`} className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="font-medium text-primary">{o.briefTitle}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Order {o.status === 'awaiting_payment' ? '· payment pending' : '· in preparation'}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </li>
            ))}
            {capitalCallsDue.length === 0 && docRequests.length === 0 && activeOrders.length === 0 ? (
              <li className="text-xs leading-relaxed text-muted-foreground">Nothing outstanding. Your workspace is current.</li>
            ) : null}
          </ul>
        </div>
      </section>

      {/* ============ Saved + recent + scenarios + portfolio ============ */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg text-primary">Saved & recently viewed</h3>
            <Link href="/portal/discover" className="text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
              Discover
            </Link>
          </div>
          {savedOpportunities.length === 0 && recentOpportunityIds.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Nothing saved yet. Save opportunities from Discover to build a private pipeline that survives across sessions.
            </p>
          ) : (
            <ul className="space-y-3">
              {savedOpportunities.map((o) => (
                <li key={`s-${o._id}`} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0">
                  <Link href={`/portal/discover/${encodeURIComponent(o._id)}`} className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:text-gold">
                    {o.title}
                  </Link>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Saved</span>
                </li>
              ))}
              {recentViews
                .filter((v) => !savedIds.has(v.sanityId) && opportunities.some((o) => o._id === v.sanityId))
                .slice(0, 3)
                .map((v) => {
                  const o = opportunities.find((x) => x._id === v.sanityId)!
                  return (
                    <li key={`v-${v.sanityId}`} className="flex items-center justify-between gap-3">
                      <Link href={`/portal/discover/${encodeURIComponent(v.sanityId)}`} className="min-w-0 flex-1 truncate text-sm text-primary hover:text-gold">
                        {o.title}
                      </Link>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{relativeTime(v.viewedAt)}</span>
                    </li>
                  )
                })}
            </ul>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="min-w-0 border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg text-primary">Saved analyses</h3>
              <Link href="/portal/studio" className="text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
                Studio
              </Link>
            </div>
            {scenarios.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No scenarios yet. The Investment Studio keeps your criteria, financing and exit analysis — return months later and resume.
              </p>
            ) : (
              <ul className="space-y-3">
                {scenarios.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary">{s.name}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {s.opportunityTitle ? `${s.opportunityTitle} · ` : ''}
                        {relativeTime(s.updatedAt)}
                      </div>
                    </div>
                    <Sparkles className="h-4 w-4 flex-shrink-0 text-gold/60" />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg text-primary">Portfolio snapshot</h3>
              <Link href="/portal/portfolio" className="text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
                My investments
              </Link>
            </div>
            {positions.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No positions recorded. When you transact through Murivest, your owned and committed assets are tracked here — actual performance, distinct from pipeline analysis.
              </p>
            ) : (
              <ul className="space-y-3">
                {positions.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary">{p.name}</div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{humanizeStatus(p.status)}</div>
                    </div>
                    <Briefcase className="h-4 w-4 flex-shrink-0 text-gold/60" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ============ Advisor comms ============ */}
      <section className="min-w-0 border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-primary">From your Murivest desk</h3>
          <Link href="/portal/activity" className="text-[10px] uppercase tracking-[0.14em] text-gold hover:underline">
            Activity & communications
          </Link>
        </div>
        {latestEnquiries.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            No correspondence yet. Enquiries, brief clarifications and advisor messages all live in one thread view — with a complete audit trail.
          </p>
        ) : (
          <ul className="space-y-3">
            {latestEnquiries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-primary">{e.subject}</div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{e.message}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{relativeTime(e.updatedAt)}</div>
                </div>
                <StatusBadge status={e.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
