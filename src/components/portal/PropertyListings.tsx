import {useState} from 'react'
import {Building2, Gavel, ListChecks, ExternalLink, Lock} from 'lucide-react'
import OpportunityCard from './OpportunityCard'
import type {OpportunityDoc} from '@/lib/sanity/types'

export type ListingTab = 'off_market' | 'auction' | 'all'

export const LISTING_TABS: {value: ListingTab; label: string; icon: React.ReactNode; count?: number}[] = [
  {value: 'off_market', label: 'Off-market', icon: <Lock className="h-4 w-4" />},
  {value: 'auction', label: 'Auction', icon: <Gavel className="h-4 w-4" />},
  {value: 'all', label: 'All Listings', icon: <ListChecks className="h-4 w-4" />},
]

export function getPublicDetailUrl(opportunity: OpportunityDoc): string | null {
  if (opportunity.listingType === 'off_market') return null
  if (!opportunity.publicDetailUrl) return null
  if (!opportunity.slug?.current) return null

  const country = opportunity.country?.toLowerCase()
  const slug = opportunity.slug.current

  switch (country) {
    case 'kenya':
      return `https://murivest.com/kenya/properties/${slug}`
    case 'uk':
    case 'united kingdom':
      return `https://murivest.com/united-kingdom/listings/${slug}`
    case 'usa':
    case 'united states':
      return `https://murivest.com/usa/properties/${slug}`
    case 'uae':
    case 'united arab emirates':
      return `https://murivest.com/united-arab-emirates/listings/${slug}`
    case 'singapore':
      return `https://murivest.com/singapore/properties/${slug}`
    default:
      return opportunity.publicDetailUrl
  }
}

export function getListingTypeLabel(type: string): string {
  switch (type) {
    case 'off_market':
      return 'Off-market'
    case 'auction':
      return 'Auction'
    case 'available_by_country':
      return 'Available by Country'
    default:
      return type
  }
}

export function getCountryLabel(country: string): string {
  const labels: Record<string, string> = {
    kenya: 'Kenya',
    uk: 'United Kingdom',
    uae: 'United Arab Emirates',
    south_africa: 'South Africa',
    nigeria: 'Nigeria',
    ghana: 'Ghana',
    tanzania: 'Tanzania',
    rwanda: 'Rwanda',
    uganda: 'Uganda',
    usa: 'USA',
    singapore: 'Singapore',
    other: 'Other',
  }
  return labels[country] || country
}

interface PropertyListingsProps {
  opportunities: OpportunityDoc[]
  userTier?: 'tier_1' | 'tier_2' | 'tier_3'
  savedIds?: Set<string>
  onSaveToggle?: (id: string, saved: boolean) => void
  viewCounts?: Record<string, number>
}

export default function PropertyListings({
  opportunities,
  userTier = 'tier_1',
  savedIds = new Set(),
  onSaveToggle,
  viewCounts = {},
}: PropertyListingsProps) {
  const [activeTab, setActiveTab] = useState<ListingTab>('all')

  const TIER_RANK = {tier_1: 1, tier_2: 2, tier_3: 3}
  const userRank = TIER_RANK[userTier]

  const filtered = opportunities.filter((o) => {
    const requiredRank = TIER_RANK[o.accessTier] || 1
    if (userRank < requiredRank) return false

    switch (activeTab) {
      case 'off_market':
        return o.listingType === 'off_market'
      case 'auction':
        return o.listingType === 'auction'
      case 'all':
      default:
        return true
    }
  })

  const tabCounts = {
    off_market: opportunities.filter((o) => o.listingType === 'off_market').length,
    auction: opportunities.filter((o) => o.listingType === 'auction').length,
    all: opportunities.length,
  }

  return (
    <section className="space-y-6" aria-labelledby="property-listings-heading">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="property-listings-heading" className="font-display text-3xl text-primary">
            Investment Opportunities
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tabCounts[activeTab]} {activeTab === 'all' ? 'properties' : 'properties'} found
          </p>
        </div>

        <div className="flex gap-2 border border-border rounded-lg bg-muted/30 p-1" role="tablist" aria-label="Property listing types">
          {LISTING_TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={activeTab === tab.value}
              aria-controls={`panel-${tab.value}`}
              id={`tab-${tab.value}`}
              onClick={() => setActiveTab(tab.value)}
              className={`press-scale inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium uppercase tracking-[0.1em] transition-colors ${
                activeTab === tab.value
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular text-primary">
                {tabCounts[tab.value]}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {filtered.length === 0 ? (
          <div className="py-16 text-center border border-border rounded-xl bg-muted/30">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium text-primary">No properties found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === 'off_market'
                ? 'No off-market properties available at your access tier.'
                : activeTab === 'auction'
                ? 'No auction properties currently listed.'
                : 'No properties match your current filters.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((opportunity) => {
              const publicUrl = getPublicDetailUrl(opportunity)
              const isOffMarket = opportunity.listingType === 'off_market'
              const isSaved = savedIds.has(opportunity._id)
              const viewCount = viewCounts[opportunity._id]

              return (
                <OpportunityCard
                  key={opportunity._id}
                  opportunity={{
                    ...opportunity,
                    publicDetailUrl: publicUrl,
                    isOffMarket,
                  } as OpportunityDoc & {publicDetailUrl?: string | null; isOffMarket?: boolean}}
                  saved={isSaved}
                  viewCount={viewCount}
                  onSaveToggle={onSaveToggle ? () => onSaveToggle(opportunity._id, !isSaved) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}