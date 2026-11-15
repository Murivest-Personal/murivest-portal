'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {ExternalLink} from 'lucide-react'
import {fmtDate} from '@/lib/format'
import {adminAction} from './client'
import {SectionCard, StatusPill, DataTable, EmptyState} from './ui'

export interface IntelligenceRow {
  sanityId: string
  title: string
  category: string
  geography: string | null
  accessTier: string
  publishDate: string | null
  metaStatus: string | null
  metaVisibilityTier: string | null
}

export default function IntelligenceWorkspace({
  rows,
  sanityConfigured,
  studioUrl,
  canManage,
}: {
  rows: IntelligenceRow[]
  sanityConfigured: boolean
  studioUrl: string
  canManage: boolean
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function setMeta(sanityId: string, payload: Record<string, unknown>) {
    setBusyId(sanityId)
    setError('')
    const res = await adminAction('content.upsertMeta', {contentType: 'report', sanityId, ...payload})
    setBusyId(null)
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
          <strong className="font-medium">Sanity CMS is not connected.</strong> Market Intelligence is authored in Sanity (market reports, country & sector insights, commentary); set SANITY_PROJECT_ID to publish. Visibility governance below applies regardless.
        </div>
      ) : null}
      {error ? <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

      <SectionCard
        title="Market Intelligence"
        description={`${rows.length} published pieces · tier visibility governs investor access`}
        actions={
          <a href={studioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:border-gold">
            <ExternalLink className="h-3 w-3" /> Author in Sanity Studio
          </a>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No intelligence published"
            description="Research, country insights and commentary are created in Sanity Studio, then visible to investors per tier."
            action={
              <a href={studioUrl} target="_blank" rel="noreferrer" className="border border-gold/40 bg-gold/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
                Open Sanity Studio
              </a>
            }
          />
        ) : (
          <DataTable head={['Title', 'Category', 'Geography', 'Sanity tier', 'Governance']}>
            {rows.map((r) => (
              <tr key={r.sanityId} className="hover:bg-accent/30">
                <td className="pl-0 pr-3 align-top">
                  <div className="font-medium text-primary">{r.title}</div>
                  <div className="text-[10px] text-muted-foreground">{r.publishDate ? fmtDate(r.publishDate) : 'unpublished'}</div>
                </td>
                <td className="px-3 align-top text-xs text-muted-foreground">{r.category.replace(/_/g, ' ')}</td>
                <td className="px-3 align-top text-xs">{r.geography ?? '—'}</td>
                <td className="px-3 align-top text-xs">{r.accessTier.replace('_', ' ')}</td>
                <td className="px-3 align-top">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.metaStatus && r.metaStatus !== 'live' ? <StatusPill status={r.metaStatus === 'archived' ? 'closed' : 'paused'} label={r.metaStatus} /> : <StatusPill status="active" label="live" />}
                    {canManage ? (
                      <>
                        <select
                          className="border border-border bg-background px-2 py-1 text-xs focus:border-gold focus:outline-none"
                          value={r.metaVisibilityTier ?? r.accessTier}
                          onChange={(e) => setMeta(r.sanityId, {visibilityTier: e.target.value})}
                          disabled={busyId === r.sanityId}
                          aria-label={`Visibility for ${r.title}`}
                        >
                          {['tier_1', 'tier_2', 'tier_3'].map((t) => (
                            <option key={t} value={t}>{t.replace('_', ' ')}</option>
                          ))}
                        </select>
                        <select
                          className="border border-border bg-background px-2 py-1 text-xs focus:border-gold focus:outline-none"
                          value={r.metaStatus ?? 'live'}
                          onChange={(e) => setMeta(r.sanityId, {status: e.target.value})}
                          disabled={busyId === r.sanityId}
                          aria-label={`Status for ${r.title}`}
                        >
                          {['live', 'paused', 'archived'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
          Tier visibility is enforced server-side alongside each report&apos;s Sanity access tier — pausing or archiving removes it from investor-facing Market Intelligence.
        </p>
      </SectionCard>
    </div>
  )
}
