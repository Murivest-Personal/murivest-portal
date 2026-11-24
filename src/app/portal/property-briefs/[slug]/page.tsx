import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {ArrowLeft, BookOpen, FileDown, Package, ShieldCheck} from 'lucide-react'
import {getBriefBySlug, getImageAssetUrl} from '@/lib/sanity/queries'
import {isSanityConfigured} from '@/lib/sanity/client'
import {requirePortalUser} from '@/lib/auth/context'
import {TierBadge} from '@/components/brand/primitives'
import {priceLabel} from '@/components/portal/BriefCard'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{slug: string}>
}): Promise<Metadata> {
  const {slug} = await params
  return {
    title: `Brief — ${slug}`,
    robots: {index: false, follow: false},
  }
}

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{slug: string}>
}) {
  const {slug} = await params
  const ctx = await requirePortalUser()

  if (!isSanityConfigured()) notFound()

  const brief = await getBriefBySlug(slug, ctx.effectiveTier)
  if (!brief) notFound()

  const coverRef = (brief as typeof brief & {coverRef?: Parameters<typeof getImageAssetUrl>[0]}).coverRef
  const coverUrl = coverRef ? getImageAssetUrl(coverRef, 1200) : null
  const pricing = brief.pricing as
    | (typeof brief.pricing & { digitalDownloadAvailable?: boolean })
    | undefined
  const digitalDownloadAvailable = !!pricing?.digitalDownloadAvailable
  const digital = priceLabel(
    brief.pricing?.digitalKes ?? null,
    brief.pricing?.digitalUsd ?? null,
    digitalDownloadAvailable,
  )
  const hard = priceLabel(
    brief.pricing?.hardKes ?? null,
    brief.pricing?.hardUsd ?? null,
    !!brief.pricing?.hardCopyAvailable,
  )

  const needsNda = !ctx.profile?.ndaAccepted && brief.accessTier !== 'tier_1'

  // Order routes — swap if your orders module lives elsewhere.
  const orderDigital = `/portal/orders/new?brief=${encodeURIComponent(brief._id)}&edition=digital`
  const orderHard = `/portal/orders/new?brief=${encodeURIComponent(brief._id)}&edition=hard`

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/property-briefs"
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All briefs
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Main column */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className="rounded-micro bg-secondary px-2 py-0.5 text-secondary-foreground">
              {brief.briefType === 'institutional_brief' ? 'Institutional brief' : 'Private brief'}
            </span>
            <TierBadge tier={brief.accessTier as 'tier_1' | 'tier_2' | 'tier_3'} />
            {brief.auctionRef ? <span>Ref {brief.auctionRef}</span> : null}
          </div>
          <h1 className="font-display text-3xl leading-tight text-primary lg:text-4xl">
            {brief.title}
          </h1>
          {brief.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {brief.description}
            </p>
          ) : null}

          {coverUrl ? (
            <div className="mt-6 overflow-hidden rounded-card border border-border bg-secondary shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt={brief.title}
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
          ) : null}

          {brief.deliveryExpectations ? (
            <section className="mt-8">
              <h2 className="mb-2 font-display text-xl text-primary">Delivery</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {brief.deliveryExpectations}
              </p>
            </section>
          ) : null}

          {Array.isArray(brief.scope) && brief.scope.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 font-display text-xl text-primary">Scope of work</h2>
              {/*
                `brief.scope` is Portable Text. Swap this block for your
                <PortableText value={brief.scope} components={...} /> renderer.
              */}
              <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {brief.scope
                  .filter((block: any) => block?._type === 'block')
                  .map((block: any, i: number) => (
                    <li key={block._key ?? i} className="border-l-2 border-gold/40 pl-3">
                      {Array.isArray(block.children)
                        ? block.children.map((c: any) => c.text).join('')
                        : null}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Sticky order panel */}
        <aside className="lg:sticky lg:top-8">
          <div className="rounded-card border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl text-primary">Order this brief</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Prices are confirmed at checkout. Digital editions deliver to your document room; hard copies are printed and couriered.
            </p>

            {needsNda ? (
              <div className="mt-4 rounded-micro border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs text-primary">
                <ShieldCheck className="mb-1 inline h-4 w-4 text-gold" />{' '}
                <Link
                  href="/documents?nda=1"
                  className="underline decoration-gold/50 underline-offset-2 hover:text-gold"
                >
                  Accept the confidentiality agreement
                </Link>{' '}
                to place orders on this brief.
              </div>
            ) : null}

            <ul className="mt-5 space-y-3">
              <li className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-start gap-2">
                  <FileDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold/70" />
                  <div>
                    <div className="text-sm font-medium text-primary">Digital edition</div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Delivered to your data room
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-primary">{digital}</div>
                  {digitalDownloadAvailable ? (
                    <Link
                      href={orderDigital}
                      aria-disabled={needsNda}
                      className={
                        needsNda
                          ? 'pointer-events-none mt-1 inline-block rounded-pill bg-secondary px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground'
                          : 'mt-1 inline-block rounded-pill bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep'
                      }
                    >
                      Order
                    </Link>
                  ) : (
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Unavailable
                    </div>
                  )}
                </div>
              </li>
              <li className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold/70" />
                  <div>
                    <div className="text-sm font-medium text-primary">Hard copy</div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Printed &amp; couriered
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-primary">{hard}</div>
                  {brief.pricing?.hardCopyAvailable ? (
                    <Link
                      href={orderHard}
                      aria-disabled={needsNda}
                      className={
                        needsNda
                          ? 'pointer-events-none mt-1 inline-block rounded-pill bg-secondary px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground'
                          : 'mt-1 inline-block rounded-pill bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep'
                      }
                    >
                      Order
                    </Link>
                  ) : (
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Unavailable
                    </div>
                  )}
                </div>
              </li>
            </ul>

            {brief.pricing?.notes ? (
              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                {brief.pricing.notes}
              </p>
            ) : null}

            <div className="mt-6 border-t border-border pt-4">
              <Link
                href="/property-briefs"
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Browse other briefs
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}