import type {Metadata} from 'next'
import Link from 'next/link'
import {getBriefs} from '@/lib/sanity/queries'
import {isSanityConfigured} from '@/lib/sanity/client'
import {requirePortalUser} from '@/lib/auth/context'
import {EmptyState} from '@/components/brand/primitives'
import {BookOpen, FolderLock} from 'lucide-react'
import {BriefCard, type BriefRow} from '@/components/portal/BriefCard'

export const metadata: Metadata = {
  title: 'Investment briefs — orderable catalogue',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function BriefsPage() {
  const ctx = await requirePortalUser()
  const briefs = await getBriefs(ctx.effectiveTier)

  const rows: BriefRow[] = briefs.map((b) => ({
    id: b._id,
    title: b.title,
    slug: b.slug?.current ?? null,
    briefType: b.briefType,
    accessTier: b.accessTier,
    description: b.description ?? null,
    deliveryExpectations: b.deliveryExpectations ?? null,
    coverImageUrl: null,
    coverImageAlt: null,
    digitalKes: b.pricing?.digitalKes ?? null,
    digitalUsd: b.pricing?.digitalUsd ?? null,
    hardKes: b.pricing?.hardKes ?? null,
    hardUsd: b.pricing?.hardUsd ?? null,
    digitalDownloadAvailable: false,
    hardCopyAvailable: !!b.pricing?.hardCopyAvailable,
    linkedOpportunityId: b.linkedOpportunityId ?? null,
  }))

  const needsNda =
    !ctx.profile?.ndaAccepted && rows.some((b) => b.accessTier !== 'tier_1')

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Catalogue</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Investment briefs</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Private and institutional briefs, written per asset and delivered to your secure Document Room. Digital editions are available to download immediately; hard copies are printed and couriered. Prices are set per brief by the desk and confirmed at order.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/portal/documents"
            className="rounded-pill inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary transition-colors hover:border-gold hover:text-gold"
          >
            Open the data room
          </Link>
        </div>
      </div>

      {needsNda ? (
        <div className="rounded-card mb-6 border border-gold/40 bg-gold/5 px-5 py-4 text-xs text-primary">
          <strong className="font-semibold">Confidentiality agreement required.</strong>{' '}
          Some briefs are gated to confidential tiers. Accept the agreement in the{' '}
          <Link href="/portal/documents?nda=1" className="underline decoration-gold/50 underline-offset-2 hover:text-gold">
            data room
          </Link>{' '}
          to unlock them.
        </div>
      ) : null}

      {!isSanityConfigured() ? (
        <EmptyState
          icon={FolderLock}
          title="Catalogue not connected"
          body="The content studio isn't reachable — briefs cannot be fetched. Once Sanity is configured, published briefs will appear here."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No briefs at your tier"
          body="Orderable briefs are permission-gated by access tier. Raise your verification tier through onboarding and KYC, or ask the desk to publish a brief to your account."
          action={
            <Link
              href="/documents?tab=requests"
              className="press-scale rounded-standard inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold"
            >
              Request a brief
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <BriefCard key={b.id} brief={b} />
          ))}
        </div>
      )}
    </div>
  )
}