'use client'

import {useMemo, useState} from 'react'
import Link from 'next/link'
import {Bookmark, Search as SearchIcon, SlidersHorizontal, Save, X} from 'lucide-react'
import {cn} from '@/lib/utils'
import type {OpportunityDoc} from '@/lib/sanity/types'
import OpportunityCard from './OpportunityCard'
import {EmptyState} from '@/components/brand/primitives'
import {ASSET_CLASS_OPTIONS, DEAL_STRUCTURE_OPTIONS, OPPORTUNITY_STATUS_OPTIONS} from '@/lib/constants'

export interface DiscoverItem {
  opportunity: OpportunityDoc
  saved: boolean
  matchedTags: string[]
  viewCount: number
}

const SEGMENTS = [
  {key: 'all', label: 'All'},
  {key: 'off_market', label: 'Off-market'},
  {key: 'auction', label: 'Auction'},
  {key: 'high_interest', label: 'High interest'},
] as const

const selectCls = 'border border-border bg-card px-3 py-2 text-xs text-foreground focus:border-gold focus:outline-none'

export default function DiscoverWorkspace({
  items,
  sanityConfigured,
  initialSavedSearchName,
}: {
  items: DiscoverItem[]
  sanityConfigured: boolean
  initialSavedSearchName?: string | null
}) {
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]['key']>('all')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [assetClass, setAssetClass] = useState('all')
  const [structure, setStructure] = useState('all')
  const [minYield, setMinYield] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(({opportunity: o, viewCount}) => {
      if (segment === 'off_market' && o.status !== 'off_market') return false
      if (segment === 'auction' && o.status !== 'auction') return false
      if (segment === 'high_interest' && viewCount < 3) return false
      if (status !== 'all' && o.status !== status) return false
      if (assetClass !== 'all' && o.assetClass !== assetClass) return false
      if (structure !== 'all' && o.dealStructure !== structure) return false
      if (minYield && !(o.financials?.netYieldPct != null && o.financials.netYieldPct >= Number(minYield))) return false
      const price = o.indicativePrice?.amount
      if (minPrice && !(price != null && price >= Number(minPrice))) return false
      if (maxPrice && !(price != null && price <= Number(maxPrice))) return false
      if (q) {
        const hay = `${o.title} ${o.summary || ''} ${o.geography?.city || ''} ${o.geography?.country || ''} ${o.geography?.district || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, segment, query, status, assetClass, structure, minYield, minPrice, maxPrice])

  const activeFilterCount = [status, assetClass, structure, minYield, minPrice, maxPrice].filter((v) => v && v !== 'all').length

  async function saveSearch() {
    const name = window.prompt('Name this search (visible only to you):', initialSavedSearchName || 'New search')
    if (!name) return
    await fetch('/api/saved-searches', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name,
        filters: {segment, status, assetClass, structure, minYield, minPrice, maxPrice, query},
        alertOnNew: true,
      }),
    }).catch(() => {})
    window.location.reload()
  }

  return (
    <div>
      {/* Segment control */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-x-auto border border-border" role="tablist" aria-label="Discover segments">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={segment === s.key}
              onClick={() => setSegment(s.key)}
              className={cn(
                'whitespace-nowrap px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors',
                segment === s.key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-primary',
              )}
            >
              {s.label}
              {s.key === 'high_interest' ? <span className="ml-1.5 text-gold">·</span> : null}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, market, district…"
              aria-label="Search opportunities"
              className="border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-gold focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="relative inline-flex items-center gap-2 border border-border bg-card px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center bg-gold px-1 text-[9px] font-bold text-forest-deep">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters ? (
        <div className="mb-6 grid gap-3 border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Status</span>
            <select className={cn(selectCls, 'w-full')} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Any status</option>
              {OPPORTUNITY_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Asset class</span>
            <select className={cn(selectCls, 'w-full')} value={assetClass} onChange={(e) => setAssetClass(e.target.value)}>
              <option value="all">Any class</option>
              {ASSET_CLASS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Structure</span>
            <select className={cn(selectCls, 'w-full')} value={structure} onChange={(e) => setStructure(e.target.value)}>
              <option value="all">Any structure</option>
              {DEAL_STRUCTURE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Min net yield %</span>
            <input inputMode="decimal" className={cn(selectCls, 'w-full')} value={minYield} onChange={(e) => setMinYield(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 7" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Price from</span>
            <input inputMode="decimal" className={cn(selectCls, 'w-full')} value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ''))} placeholder="min" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Price to</span>
            <input inputMode="decimal" className={cn(selectCls, 'w-full')} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ''))} placeholder="max" />
          </label>
          <div className="flex items-center justify-between gap-2 sm:col-span-3 lg:col-span-6">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {filtered.length} of {items.length} opportunities · permission-filtered
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={saveSearch} className="inline-flex items-center gap-1.5 border border-gold/50 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-primary hover:bg-gold/10">
                <Save className="h-3.5 w-3.5 text-gold" /> Save search + alerts
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus('all')
                  setAssetClass('all')
                  setStructure('all')
                  setMinYield('')
                  setMinPrice('')
                  setMaxPrice('')
                  setQuery('')
                }}
                className="inline-flex items-center gap-1.5 border border-border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-gold"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Results */}
      {!sanityConfigured ? (
        <EmptyState
          icon={Bookmark}
          title="Opportunity intelligence awaits publication"
          body="Opportunities are uploaded and published by Murivest through the content studio. When inventory goes live, this workspace fills automatically with tier-gated listings — the portal never displays generic or sample inventory."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title={items.length === 0 ? 'Nothing published at your tier yet' : 'No opportunities match these filters'}
          body={
            items.length === 0
              ? 'Opportunities visible to you are governed by your verification tier. New inventory clears verification continuously — save a search with alerts to be notified first.'
              : 'Adjust the filters or widen the search. Everything you see is already permission-filtered to your access tier.'
          }
          action={
            <Link href="/portal/orders" className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
              Order a custom brief instead
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map(({opportunity, saved, matchedTags, viewCount}) => (
            <OpportunityCard key={opportunity._id} opportunity={opportunity} saved={saved} matchedTags={matchedTags} viewCount={viewCount} />
          ))}
        </div>
      )}
    </div>
  )
}
