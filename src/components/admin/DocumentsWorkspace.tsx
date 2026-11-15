'use client'

import {useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Loader2, ExternalLink, Lock} from 'lucide-react'
import {fmtDate, fmtDateTime, relativeTime} from '@/lib/format'
import {adminAction, inputClass, labelClass} from './client'
import {SectionCard, StatusPill, DataTable, EmptyState} from './ui'

export interface DocumentsData {
  grants: {id: string; sanityDocumentId: string; userId: string | null; organisationId: string | null; userName: string | null; permission: string; expiresAt: string | null; createdAt: string}[]
  requests: {id: string; userId: string; userName: string; subject: string; detail: string | null; type: string; status: string; createdAt: string}[]
  accessLogs: {id: string; userId: string; userName: string; sanityDocumentId: string; documentTitle: string | null; action: string; ip: string | null; createdAt: string}[]
  metas: {sanityId: string; status: string; visibilityTier: string; tags: unknown; notes: string | null}[]
  sanityDocs: {_id: string; title: string; docType: string; accessTier: string; downloadable: boolean | null; publishDate: string | null; fileExtension: string | null}[]
  sanityConfigured: boolean
  studioUrl: string
  can: {manage: boolean}
}

export default function DocumentsWorkspace({data}: {data: DocumentsData}) {
  const router = useRouter()
  const {grants, requests, accessLogs, sanityDocs, sanityConfigured, studioUrl, can} = data
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Grant composer
  const [docId, setDocId] = useState('')
  const [grantUserId, setGrantUserId] = useState('')
  const [permission, setPermission] = useState('view')
  const [expiresAt, setExpiresAt] = useState('')

  const [tab, setTab] = useState<'grants' | 'requests' | 'access' | 'inventory'>('grants')

  async function run(action: string, payload: Record<string, unknown>, okMessage: string) {
    setBusy(true)
    setError('')
    setMessage('')
    const res = await adminAction(action, payload)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Action failed.')
      return false
    }
    setMessage(okMessage)
    router.refresh()
    return true
  }

  const requestUserId = requests.length > 0 ? requests[0].userId : ''

  return (
    <div className="space-y-6">
      {!sanityConfigured ? (
        <div className="border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-primary">
          <strong className="font-medium">Sanity CMS is not connected.</strong> Data-room documents are uploaded to Sanity; connect SANITY_PROJECT_ID to list them here. Grants, requests and access logs below are tracked locally regardless.
        </div>
      ) : null}

      {message ? <div className="border border-forest/30 bg-forest/10 px-3 py-2 text-xs text-forest">{message}</div> : null}
      {error ? <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

      <div className="flex flex-wrap gap-1 border-b border-border pb-2" role="tablist" aria-label="Data room views">
        {([
          ['grants', `Grants (${grants.length})`],
          ['requests', `Requests (${requests.length})`],
          ['access', `Access log (${accessLogs.length})`],
          ['inventory', `Documents (${sanityDocs.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs transition-colors ${tab === key ? 'border-b-2 border-gold font-medium text-primary' : 'text-muted-foreground hover:text-primary'}`}
          >
            {label}
          </button>
        ))}
        <a href={studioUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-gold-deep hover:text-gold">
          <ExternalLink className="h-3 w-3" /> Sanity Studio
        </a>
      </div>

      {can.manage ? (
        <SectionCard title="Grant document access" description="Per-investor or organisation-level permission with optional expiry">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="doc">Document (Sanity id)</label>
              {sanityDocs.length > 0 ? (
                <select id="doc" className={inputClass} value={docId} onChange={(e) => setDocId(e.target.value)}>
                  <option value="">Select a document…</option>
                  {sanityDocs.map((d) => (
                    <option key={d._id} value={d._id}>{d.title}</option>
                  ))}
                </select>
              ) : (
                <input id="doc" className={inputClass} placeholder="e.g. production.reports/abc123" value={docId} onChange={(e) => setDocId(e.target.value)} />
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="grant-user">Investor user id</label>
              <input id="grant-user" className={inputClass} placeholder="user id" value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="grant-perm">Permission</label>
              <select id="grant-perm" className={inputClass} value={permission} onChange={(e) => setPermission(e.target.value)}>
                <option value="view">View only</option>
                <option value="download">View + download</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="grant-exp">Expires (optional)</label>
              <input id="grant-exp" type="date" className={inputClass} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            disabled={busy || !docId || !grantUserId}
            onClick={async () => {
              const okRun = await run('document.grant', {sanityDocumentId: docId, userId: grantUserId, permission, expiresAt: expiresAt || null}, 'Access granted — the investor has been notified.')
              if (okRun) {
                setDocId('')
                setGrantUserId('')
                setExpiresAt('')
              }
            }}
            className="mt-3 inline-flex items-center gap-2 bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Grant access
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Tip: for request fulfilment, open the investor from the request below and grant there — or use the investor user id pre-filled from a request ({requestUserId ? requestUserId.slice(0, 12) + '…' : 'none pending'}).
          </p>
        </SectionCard>
      ) : null}

      {tab === 'grants' ? (
        <SectionCard title="Active grants" description="Per-document access permissions with expiry">
          {grants.length === 0 ? (
            <EmptyState title="No grants yet" description="Grant document access to investors above, or from an investor record." />
          ) : (
            <DataTable head={['Document', 'Grantee', 'Permission', 'Expires', 'Granted', '']}>
              {grants.map((g) => {
                const title = sanityDocs.find((d) => d._id === g.sanityDocumentId)?.title ?? g.sanityDocumentId
                const expired = g.expiresAt && g.expiresAt < new Date().toISOString()
                return (
                  <tr key={g.id}>
                    <td className="pl-0 pr-3 align-top">
                      <div className="max-w-64 truncate text-xs font-medium text-primary" title={g.sanityDocumentId}>{title}</div>
                    </td>
                    <td className="px-3 align-top text-xs">{g.userName ?? `Organisation ${g.organisationId?.slice(0, 10)}`}</td>
                    <td className="px-3 align-top"><StatusPill status={g.permission === 'download' ? 'verified' : 'in_review'} label={g.permission} /></td>
                    <td className="px-3 align-top text-xs">{g.expiresAt ? <span className={expired ? 'text-destructive' : 'text-gold-deep'}>{expired ? 'expired ' : ''}{fmtDate(g.expiresAt)}</span> : 'no expiry'}</td>
                    <td className="px-3 align-top text-xs text-muted-foreground">{relativeTime(g.createdAt)}</td>
                    <td className="px-3 align-top">
                      {can.manage ? (
                        <button type="button" disabled={busy} onClick={() => run('document.revoke', {grantId: g.id}, 'Grant revoked.')} className="border border-destructive/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-destructive disabled:opacity-60">
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </DataTable>
          )}
        </SectionCard>
      ) : null}

      {tab === 'requests' ? (
        <SectionCard title="Document requests" description="Investor requests awaiting fulfilment">
          {requests.length === 0 ? (
            <EmptyState title="No requests" description="Investor document requests appear here for fulfilment." />
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="border border-border p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusPill status={r.status} />
                      <span className="text-sm font-medium text-primary">{r.subject}</span>
                      <StatusPill status="in_review" label={r.type.replace(/_/g, ' ')} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{r.userName} · {relativeTime(r.createdAt)}</span>
                  </div>
                  {r.detail ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.detail}</p> : null}
                  {can.manage ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button type="button" disabled={busy} onClick={() => run('document.requestStatus', {requestId: r.id, status: 'in_review'}, 'Marked in review.')} className="border border-border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60">
                        In review
                      </button>
                      <button type="button" disabled={busy} onClick={() => run('document.requestStatus', {requestId: r.id, status: 'ready'}, 'Marked ready — investor notified.')} className="border border-forest/40 bg-forest/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60">
                        Ready
                      </button>
                      <button type="button" disabled={busy} onClick={() => run('document.requestStatus', {requestId: r.id, status: 'declined'}, 'Request declined — investor notified.')} className="border border-destructive/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-destructive disabled:opacity-60">
                        Decline
                      </button>
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        <Lock className="h-3 w-3" /> fulfil via grants above
                      </span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {tab === 'access' ? (
        <SectionCard title="Access log" description="Every view and download — audited">
          {accessLogs.length === 0 ? (
            <EmptyState title="No access recorded" description="Document views and downloads by investors are logged here." />
          ) : (
            <DataTable head={['Investor', 'Document', 'Action', 'IP', 'When']}>
              {accessLogs.map((l) => (
                <tr key={l.id}>
                  <td className="pl-0 pr-3 align-top text-xs">
                    <Link href={`/admin/investors/${l.userId}`} className="text-primary hover:text-gold">{l.userName}</Link>
                  </td>
                  <td className="px-3 align-top text-xs">{l.documentTitle ?? l.sanityDocumentId}</td>
                  <td className="px-3 align-top"><StatusPill status={l.action === 'download' ? 'verified' : 'in_review'} label={l.action} /></td>
                  <td className="px-3 align-top text-xs text-muted-foreground">{l.ip ?? '—'}</td>
                  <td className="px-3 align-top text-xs text-muted-foreground">{fmtDateTime(l.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </SectionCard>
      ) : null}

      {tab === 'inventory' ? (
        <SectionCard title="Document inventory" description="Sanity-sourced secure documents">
          {sanityDocs.length === 0 ? (
            <EmptyState title="No documents published" description="Upload documents in Sanity Studio; they appear here and flow to investor data rooms via grants." action={<a href={studioUrl} target="_blank" rel="noreferrer" className="border border-gold/40 bg-gold/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">Open Sanity Studio</a>} />
          ) : (
            <DataTable head={['Title', 'Type', 'Tier', 'Downloadable', 'Published']}>
              {sanityDocs.map((d) => (
                <tr key={d._id}>
                  <td className="pl-0 pr-3 align-top text-xs font-medium text-primary">{d.title}</td>
                  <td className="px-3 align-top text-xs text-muted-foreground">{d.docType.replace(/_/g, ' ')}{d.fileExtension ? ` · ${d.fileExtension}` : ''}</td>
                  <td className="px-3 align-top text-xs">{d.accessTier.replace('_', ' ')}</td>
                  <td className="px-3 align-top text-xs">{d.downloadable ? 'yes' : 'view only'}</td>
                  <td className="px-3 align-top text-xs text-muted-foreground">{d.publishDate ? fmtDate(d.publishDate) : '—'}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </SectionCard>
      ) : null}
    </div>
  )
}
