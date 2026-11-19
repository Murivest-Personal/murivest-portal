'use client'

import {useMemo, useState} from 'react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Bookmark, Search as SearchIcon, SlidersHorizontal, Save, X} from 'lucide-react'
import {cn} from '@/lib/utils'
import type {OpportunityDoc} from '@/lib/sanity/types'
import OpportunityCard from './OpportunityCard'
import {EmptyState} from '@/components/brand/primitives'
import {
  ASSET_CLASS_OPTIONS,
  DEAL_STRUCTURE_OPTIONS,
  OPPORTUNITY_STATUS_OPTIONS,
} from '@/lib/constants'
import {DISCOVER_SOURCE_OPTIONS, type DiscoverSource} from '@/sanity/lib/constants'

export interface DiscoverItem {
  opportunity: OpportunityDoc
  saved: boolean
  matchedTags: string[]
  viewCount: number
}

const selectCls =
  'rounded-standard border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors focus:border-primary'

export default function DiscoverWorkspace({
  items,
  currentSource,
  sourceLabel,
  sanityConfigured,
  initialSavedSearchName,
}: {
  items: DiscoverItem[]
  currentSource: DiscoverSource
  sourceLabel: string
  sanityConfigured: boolean
  initialSavedSearchName?: string | null
}) {
  const pathname = usePathname()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [assetClass, setAssetClass] = useState('all')
  const [structure, setStructure] = useState('all')
  const [minYield, setMinYield] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(({opportunity: o}) => {
      if (status !== 'all' && o.status !== status) return false
      if (assetClass !== 'all' && o.assetClass !== assetClass) return false
      if (structure !== 'all' && o.dealStructure !== structure) return false
      if (
        minYield &&
        !(o.financials?.netYieldPct != null && o.financials.netYieldPct >= Number(minYield))
      )
        return false
      const price = o.indicativePrice?.amount
      if (minPrice && !(price != null && price >= Number(minPrice))) return false
      if (maxPrice && !(price != null && price <= Number(maxPrice))) return false
      if (q) {
        const hay = `${o.title} ${o.summary || ''} ${o.geography?.city || ''} ${
          o.geography?.country || ''
        } ${o.geography?.district || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, query, status, assetClass, structure, minYield, minPrice, maxPrice])

  const activeFilterCount = [status, assetClass, structure, minYield, minPrice, maxPrice].filter(
    (v) => v && v !== 'all',
  ).length

  async function saveSearch() {
    const name = window.prompt(
      'Name this search (visible only to you):',
      initialSavedSearchName || 'New search',
    )
    if (!name) return
    await fetch('/api/saved-searches', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name,
        filters: {
          source: currentSource,
          status,
          assetClass,
          structure,
          minYield,
          minPrice,
          maxPrice,
          query,
        },
        alertOnNew: true,
      }),
    }).catch(() => {})
    window.location.reload()
  }

  function resetFilters() {
    setStatus('all')
    setAssetClass('all')
    setStructure('all')
    setMinYield('')
    setMinPrice('')
    setMaxPrice('')
    setQuery('')
  }

  return (
    <div>
      {/* Source selection — navigates, does not filter */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex overflow-x-auto border border-border"
          role="tablist"
          aria-label="Discover sources"
        >
          {DISCOVER_SOURCE_OPTIONS.map((s) => {
            const active = currentSource === s.key
            return (
              <Link
                key={s.key}
                href={{pathname, query: {source: s.key}}}
                prefetch={false}
                scroll={false}
                role="tab"
                aria-selected={active}
                className={cn(
                  'whitespace-nowrap px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-primary',
                )}
              >
                {s.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, market, district…"
              aria-label="Search opportunities"
              className="rounded-standard border border-border bg-card py-2 pl-9 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="press-scale rounded-standard relative inline-flex items-center gap-2 border border-border bg-card px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] text-primary transition-colors hover:border-gold hover:text-gold"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center bg-gold px-1 text-[9px] font-bold text-forest-deep">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Refinement filters — refine the selected source, don't change it */}
      {showFilters ? (
        <div className="mb-6 grid gap-3 rounded-card border border-border bg-card shadow-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Status
            </span>
            <select
              className={cn(selectCls, 'w-full')}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Any status</option>
              {OPPORTUNITY_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Asset class
            </span>
            <select
              className={cn(selectCls, 'w-full')}
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value)}
            >
              <option value="all">Any class</option>
              {ASSET_CLASS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Structure
            </span>
            <select
              className={cn(selectCls, 'w-full')}
              value={structure}
              onChange={(e) => setStructure(e.target.value)}
            >
              <option value="all">Any structure</option>
              {DEAL_STRUCTURE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Min net yield %
            </span>
            <input
              inputMode="decimal"
              className={cn(selectCls, 'w-full')}
              value={minYield}
              onChange={(e) => setMinYield(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="e.g. 7"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Price from
            </span>
            <input
              inputMode="decimal"
              className={cn(selectCls, 'w-full')}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="min"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Price to
            </span>
            <input
              inputMode="decimal"
              className={cn(selectCls, 'w-full')}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="max"
            />
          </label>
          <div className="flex items-center justify-between gap-2 sm:col-span-3 lg:col-span-6">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {filtered.length} of {items.length} · {sourceLabel} · permission-filtered
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveSearch}
                className="inline-flex items-center gap-1.5 border border-gold/50 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-primary hover:bg-gold/10"
              >
                <Save className="h-3.5 w-3.5 text-gold" /> Save search + alerts
              </button>
              <button
                type="button"
                onClick={resetFilters}
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
          title={
            items.length === 0
              ? `Nothing published in ${sourceLabel.toLowerCase()} at your tier yet`
              : 'No properties match these filters'
          }
          body={
            items.length === 0
              ? 'Each source is governed by your verification tier. Raise your tier through onboarding and KYC, or switch to another source — new inventory clears verification continuously.'
              : 'Adjust the filters or widen the search. Everything you see is already permission-filtered to your access tier.'
          }
          action={
            <Link
              href="/portal/orders"
              className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold"
            >
              Order a custom brief instead
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map(({opportunity, saved, matchedTags, viewCount}) => (
            <OpportunityCard
              key={opportunity._id}
              opportunity={{...opportunity, isOffMarket: opportunity.isOffMarket ?? undefined}}
              saved={saved}
              matchedTags={matchedTags}
              viewCount={viewCount}
            />
          ))}
        </div>
      )}
    </div>
  )
}
