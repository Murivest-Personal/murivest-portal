import type {Metadata} from 'next'
import {requirePortalUser} from '@/lib/auth/context'
import {supabase} from '@/lib/supabase'
import {getDiscoverBySource} from '@/lib/sanity/queries'
import {isDiscoverSanityConfigured} from '@/lib/sanity/client'
import {isDiscoverSource, DISCOVER_SOURCE_OPTIONS, type DiscoverSource} from '@/sanity/lib/constants'
import DiscoverWorkspace from '@/components/portal/DiscoverWorkspace'

export const metadata: Metadata = {
  title: 'Discover — opportunities',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalUser()
  const sp = await searchParams
  const sourceParam = typeof sp.source === 'string' ? sp.source : undefined
  const source: DiscoverSource = isDiscoverSource(sourceParam) ? sourceParam : 'all'

  const opportunities = await getDiscoverBySource(source, ctx.effectiveTier)
  const oppIds = opportunities.map((o) => o._id)

  // Enrichment — keep whatever shape your original page used
  const savedQuery = oppIds.length
    ? supabase
        .from('saved_opportunities')
        .select('opportunity_id')
        .eq('user_id', ctx.user.id)
        .in('opportunity_id', oppIds)
    : Promise.resolve({data: [] as {opportunity_id: string}[]})

  const viewsQuery = oppIds.length
    ? supabase
        .from('opportunity_views')
        .select('opportunity_id')
        .in('opportunity_id', oppIds)
    : Promise.resolve({data: [] as {opportunity_id: string}[]})

  const [savedRes, viewsRes] = await Promise.all([savedQuery, viewsQuery])

  const savedSet = new Set(
    ((savedRes.data ?? []) as {opportunity_id: string}[]).map((r) => r.opportunity_id),
  )
  const viewCounts = new Map<string, number>()
  for (const r of (viewsRes.data ?? []) as {opportunity_id: string}[]) {
    viewCounts.set(r.opportunity_id, (viewCounts.get(r.opportunity_id) ?? 0) + 1)
  }

  const sourceLabel =
    DISCOVER_SOURCE_OPTIONS.find((o) => o.key === source)?.label ?? 'All properties'

  const items = opportunities.map((o) => ({
    opportunity: o,
    saved: savedSet.has(o._id),
    matchedTags: [] as string[], // ← substitute your existing tag-matching logic if you have one
    viewCount: viewCounts.get(o._id) ?? 0,
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Discover</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">
          {source === 'all' ? 'Opportunities' : sourceLabel}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Off-market opportunities, auction properties and country listings. Each source
          is fetched independently and permission-filtered to your access tier — select a
          source above to view its inventory.
        </p>
      </div>
      <DiscoverWorkspace
        key={source}
        items={items}
        currentSource={source}
        sourceLabel={sourceLabel}
        sanityConfigured={isDiscoverSanityConfigured(source)}
      />
    </div>
  )
}
