import type {Metadata} from 'next'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {MandateRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import {getOpportunities} from '@/lib/sanity/queries'
import {isSanityConfigured} from '@/lib/sanity/client'
import {getCriteria, getSavedIds, getViewCounts} from '@/lib/portal/data'
import {matchOpportunity} from '@/lib/portal/matching'
import DiscoverWorkspace from '@/components/portal/DiscoverWorkspace'

export const metadata: Metadata = {
  title: 'Discover — opportunity intelligence',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const ctx = await requirePortalUser()
  const uid = ctx.user.id

  const [criteria, savedIds, viewCounts, opportunities, mandates] = await Promise.all([
    getCriteria(uid),
    getSavedIds(uid),
    getViewCounts(),
    getOpportunities(ctx.effectiveTier),
    supabase
      .from('mandates')
      .select('*')
      .eq('user_id', uid)
      .in('status', ['active', 'submitted'])
      .then((res) => toCamelList(unwrap<MandateRow[]>(res, 'mandates.list'))),
  ])

  const items = opportunities.map((o) => {
    const match = matchOpportunity(o, criteria)
    // Mandate-matching tags
    const mandateTags: string[] = []
    for (const m of mandates) {
      const classes = (m.assetClasses as string[]) || []
      const geos = (m.geographies as {country?: string; city?: string}[]) || []
      const classHit = classes.length === 0 || (o.assetClass && classes.includes(o.assetClass))
      const geoHit =
        geos.length === 0 ||
        geos.some((g) => {
          const c = g.country?.toLowerCase()
          const city = g.city?.toLowerCase()
          const opCountry = (o.geography?.country || '').toLowerCase()
          const opCity = (o.geography?.city || '').toLowerCase()
          return (c && opCountry.includes(c)) || (city && opCity.includes(city))
        })
      if (classHit && geoHit) mandateTags.push(`Mandate: ${m.title}`)
    }
    return {
      opportunity: o,
      saved: savedIds.has(o._id),
      matchedTags: [...match.reasons.slice(0, 1), ...mandateTags.slice(0, 1)],
      viewCount: viewCounts.get(o._id) || 0,
    }
  })

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Opportunity intelligence</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Discover</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Permission-controlled commercial real estate and alternative investment opportunities — off-market, marketed and auction-sourced. Every listing shows only the financial detail your verification tier permits.
        </p>
      </div>
      <DiscoverWorkspace items={items} sanityConfigured={isSanityConfigured()} />
    </div>
  )
}
