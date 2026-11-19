'use client'

import {useMemo, useState} from 'react'
import {useRouter} from 'next/navigation'
import {ExternalLink, Download, Loader2, Archive, RefreshCw} from 'lucide-react'
import {fmtMoney, fmtNumber} from '@/lib/format'
import {adminAction} from './client'
import {SectionCard, StatusPill, DataTable, EmptyState} from './ui'
import {cn} from '@/lib/utils'

export interface OpportunityRow {
  sanityId: string
  title: string
  status: string
  accessTier: string
  assetClass: string | null
  geography: {country?: string | null; city?: string | null} | null
  indicativePrice: {amount?: number | null; currency?: string | null} | null
  publishDate: string | null
  auctionUrl: string | null
  metaStatus: string | null
  metaTags: string[]
  metaVisibilityTier: string | null
  views: number
  uniqueViewers: number
  saves: number
  orders: number
  revenueUsd: number
  kycBuyerForm?: unknown | null
}

export default function OpportunitiesWorkspace({
  rows,
  sanityConfigured,
  studioUrl,
  canManage,
  canExport,
  canDownloadKyc,
}: {
  rows: OpportunityRow[]
  sanityConfigured: boolean
  studioUrl: string
  canManage: boolean
  canExport: boolean
  canDownloadKyc: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'live' | 'paused' | 'archived' | 'auction'>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'auction' && !(r.status === 'auction' || r.auctionUrl || r.metaTags.includes('auction'))) return false
      if (['live', 'paused', 'archived'].includes(filter) && (r.metaStatus ?? 'live') !== filter) return false
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [rows, filter, search])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.sanityId))))
  }

  async function bulkStatus(status: 'live' | 'paused' | 'archived') {
    if (selected.size === 0) return
    setBusy(true)
    setError('')
    setMessage('')
    const res = await adminAction('content.bulkMeta', {contentType: 'opportunity', sanityIds: [...selected], status})
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Bulk action failed.')
      return
    }
    setMessage(`${res.count} opportunit${res.count === 1 ? 'y' : 'ies'} set to ${status}.`)
    setSelected(new Set())
    router.refresh()
  }

  async function setMeta(sanityId: string, payload: Record<string, unknown>) {
    setBusy(true)
    setError('')
    setMessage('')
    const res = await adminAction('content.upsertMeta', {contentType: 'opportunity', sanityId, ...payload})
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Update failed.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {!sanityConfigured ? (
        <div className="border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-primary">
          <strong className="font-medium">Sanity CMS is not connected.</strong> Properties and documents are uploaded and authored in Sanity — set
          SANITY_PROJECT_ID (and optionally SANITY_API_READ_TOKEN) to publish inventory. Rows below reflect portal interaction history and any
          governance state recorded locally.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'live', 'paused', 'archived', 'auction'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors',
                filter === f ? 'border-gold bg-gold/10 text-primary' : 'border-border text-muted-foreground hover:text-primary',
              )}
            >
              {f === 'auction' ? 'Auction-linked' : f}
            </button>
          ))}
          <input
            className="ml-0 rounded-standard border border-border bg-background px-3 py-1.5 text-xs focus:border-primary sm:ml-2"
            placeholder="Search title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search opportunities"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && selected.size > 0 ? (
            <>
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{selected.size} selected</span>
              <button type="button" disabled={busy} onClick={() => bulkStatus('live')} className="inline-flex items-center gap-1 border border-forest/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-primary disabled:opacity-60">
                <RefreshCw className="h-3 w-3" /> Restore live
              </button>
              <button type="button" disabled={busy} onClick={() => bulkStatus('paused')} className="border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-primary disabled:opacity-60">
                Pause
              </button>
              <button type="button" disabled={busy} onClick={() => bulkStatus('archived')} className="inline-flex items-center gap-1 border border-destructive/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-destructive disabled:opacity-60">
                <Archive className="h-3 w-3" /> Archive
              </button>
            </>
          ) : null}
          {canExport ? (
            <a href="/api/admin/export?dataset=opportunities" className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
              <Download className="h-3 w-3" /> CSV
            </a>
          ) : null}
          <a href={studioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:border-gold">
            <ExternalLink className="h-3 w-3" /> Sanity Studio
          </a>
        </div>
      </div>

      {message ? <div className="border border-forest/30 bg-forest/10 px-3 py-2 text-xs text-forest">{message}</div> : null}
      {error ? <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

      <SectionCard title="Inventory" description={`${filtered.length} of ${rows.length} opportunities · interaction analytics from the portal`}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No opportunities in this view"
            description={sanityConfigured ? 'Publish opportunities in Sanity Studio to populate the inventory.' : 'Connect Sanity and publish opportunities to populate the inventory.'}
            action={
              <a href={studioUrl} target="_blank" rel="noreferrer" className="border border-gold/40 bg-gold/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
                Open Sanity Studio
              </a>
            }
          />
        ) : (
          <DataTable head={[canManage ? <input key="sel" type="checkbox" aria-label="Select all" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-forest" /> : '', 'Opportunity', 'Status', 'Visibility', 'Demand signals', 'Revenue']}>
            {filtered.map((r) => {
              const governance = r.metaStatus ?? 'live'
              return (
                <tr key={r.sanityId} className="hover:bg-accent/30">
                  {canManage ? (
                    <td className="pl-0 pr-2 align-top">
                      <input type="checkbox" aria-label={`Select ${r.title}`} checked={selected.has(r.sanityId)} onChange={() => toggle(r.sanityId)} className="accent-forest" />
                    </td>
                  ) : null}
                  <td className="px-3 align-top">
                    <div className="font-medium text-primary">{r.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.assetClass ?? '—'} · {[r.geography?.city, r.geography?.country].filter(Boolean).join(', ') || '—'}
                      {r.indicativePrice?.amount != null ? ` · ${fmtMoney(r.indicativePrice.amount, r.indicativePrice.currency ?? 'USD', {compact: true})}` : ''}
                      {r.auctionUrl ? <a href={r.auctionUrl} target="_blank" rel="noreferrer" className="ml-1 text-gold-deep hover:text-gold">auctions.murivest.com ↗</a> : null}
                    </div>
                    {canDownloadKyc && (
                      <a
                        href={`/api/admin/kyc-form?sanityId=${encodeURIComponent(r.sanityId)}`}
                        className="mt-1 inline-flex items-center gap-1 border border-border rounded px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-primary hover:border-gold hover:text-gold"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="h-2.5 w-2.5" /> KYC PDF
                      </a>
                    )}
                  </td>
                  <td className="px-3 align-top">
                    <StatusPill status={r.status} />
                    {governance !== 'live' ? (
                      <div className="mt-1">
                        <StatusPill status={governance === 'archived' ? 'closed' : 'paused'} label={governance} />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 align-top">
                    {canManage ? (
                      <select
                        className="rounded-standard border border-border bg-background px-2 py-1 text-xs focus:border-primary"
                        value={r.metaVisibilityTier ?? r.accessTier}
                        onChange={(e) => setMeta(r.sanityId, {visibilityTier: e.target.value})}
                        aria-label={`Visibility tier for ${r.title}`}
                      >
                        {['tier_1', 'tier_2', 'tier_3'].map((t) => (
                          <option key={t} value={t}>{t.replace('_', ' ')}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs">{(r.metaVisibilityTier ?? r.accessTier).replace('_', ' ')}</span>
                    )}
                    <div className="mt-1 text-[10px] text-muted-foreground">Sanity: {r.accessTier.replace('_', ' ')}</div>
                  </td>
                  <td className="px-3 align-top text-xs tabular-nums">
                    {fmtNumber(r.views)} views · {fmtNumber(r.uniqueViewers)} unique
                    <div className="text-[10px] text-muted-foreground">{r.saves} saves · {r.orders} orders</div>
                  </td>
                  <td className="px-3 align-top text-xs tabular-nums">{r.revenueUsd > 0 ? fmtMoney(r.revenueUsd) : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              )
            })}
          </DataTable>
        )}
        {canManage ? (
          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
            Governance state (live / paused / archived) and the visibility floor are enforced by the portal alongside each document&apos;s Sanity access tier —
            pausing or archiving removes an opportunity from investor-facing Discover results. Content itself is created and edited in Sanity Studio.
          </p>
        ) : null}
      </SectionCard>
    </div>
  )
}
