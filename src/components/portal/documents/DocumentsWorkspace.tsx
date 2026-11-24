'use client'

import {useMemo, useState} from 'react'
import {useRouter} from 'next/navigation'
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion'
import {ChevronDown, FileDown, FolderLock, Loader2, Eye, FileStack, ShieldCheck, Send} from 'lucide-react'
import {fmtDate, humanizeStatus, relativeTime} from '@/lib/format'
import {StatusBadge, TierBadge, EmptyState} from '@/components/brand/primitives'
import {MotionDrawer} from '@/components/brand/motion'
import {EASE, SPRING, TIMING} from '@/lib/motion'
import {NDA_VERSION} from '@/lib/constants'
import {cn} from '@/lib/utils'

const input =
  'rounded-standard w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground'

export interface DocumentRow {
  id: string
  title: string
  docType: string
  accessTier: string
  description: string | null
  downloadable: boolean
  fileExtension: string | null
  fileSize: number | null
  publishDate: string | null
  linkedOpportunityId: string | null
}

export interface RequestRow {
  id: string
  subject: string
  detail: string | null
  type: string
  status: string
  createdAt: string
}

type PeriodGroup = {key: string; label: string; docs: DocumentRow[]}

/** Documents grouped by reporting period — newest quarter first. */
function groupByPeriod(docs: DocumentRow[]): PeriodGroup[] {
  const map = new Map<string, DocumentRow[]>()
  for (const d of docs) {
    const when = d.publishDate ? new Date(d.publishDate) : null
    const key = when && !Number.isNaN(when.getTime())
      ? `${when.getUTCFullYear()}-Q${Math.floor(when.getUTCMonth() / 3) + 1}`
      : 'undated'
    const bucket = map.get(key)
    if (bucket) bucket.push(d)
    else map.set(key, [d])
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([key, group]) => ({
      key,
      label: key === 'undated' ? 'Unassigned period' : key.replace(/^(\d{4})-Q(\d)$/, 'Quarter $2 · $1'),
      docs: group,
    }))
}

export default function DocumentsWorkspace({
  documents,
  requests,
  ndaAccepted,
  openNda,
  sanityConfigured,
}: {
  documents: DocumentRow[]
  requests: RequestRow[]
  ndaAccepted: boolean
  openNda: boolean
  sanityConfigured: boolean
}) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [tab, setTab] = useState<'room' | 'requests'>(documents.length > 0 ? 'room' : 'requests')
  const [ndaOpen, setNdaOpen] = useState(openNda || (!ndaAccepted && documents.some((d) => d.accessTier !== 'tier_1')))
  const [accepting, setAccepting] = useState(false)
  const [ndaError, setNdaError] = useState('')

  // Timeline accordion state — first (current) period open
  const groups = useMemo(() => groupByPeriod(documents), [documents])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(groups.slice(1).map((g) => g.key)))
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null)

  // Request form
  const [subject, setSubject] = useState('')
  const [detail, setDetail] = useState('')
  const [type, setType] = useState('data_room')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function acceptNda() {
    setAccepting(true)
    setNdaError('')
    try {
      const res = await fetch('/api/nda', {method: 'POST'})
      const data = await res.json()
      if (!res.ok || data.error) {
        setNdaError(data.error || 'Could not record acceptance.')
        return
      }
      setNdaOpen(false)
      router.refresh()
    } catch {
      setNdaError('Network error — please try again.')
    } finally {
      setAccepting(false)
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (subject.trim().length < 3) {
      setError('Add a subject for the request.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/document-requests', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({subject: subject.trim(), detail: detail.trim() || undefined, type}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not submit the request.')
        return
      }
      setNotice('Request submitted — the desk will notify you when materials are ready.')
      setSubject('')
      setDetail('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  /** Staggered sequential download of every downloadable file in a period. */
  function downloadAll(docs: DocumentRow[]) {
    docs
      .filter((d) => d.downloadable)
      .forEach((d, i) => {
        window.setTimeout(() => {
          const a = document.createElement('a')
          a.href = `/api/documents/${encodeURIComponent(d.id)}/file?download=1`
          a.rel = 'noopener'
          document.body.appendChild(a)
          a.click()
          a.remove()
        }, i * 350)
      })
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const docTypeLabel = (t: string) =>
    ({investment_memo: 'Investment memorandum', dd_pack: 'Due-diligence pack', financial_model: 'Financial model', legal: 'Legal', report: 'Report', other: 'Other'}[t] || humanizeStatus(t))

  return (
    <div>
      {/* Pill tab switcher */}
      <div className="mb-6 inline-flex rounded-pill border border-border bg-card shadow-card p-1" role="tablist">
        {(
          [
            ['room', `Data room (${documents.length})`],
            ['requests', `Requests (${requests.length})`],
          ] as const
        ).map(([key, lbl]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-pill px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors duration-200',
              tab === key ? 'bg-gold/10 font-semibold text-primary' : 'text-muted-foreground hover:text-primary',
            )}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* NDA gate */}
      {ndaOpen ? (
        <div className="rounded-card mb-8 overflow-hidden border border-gold/40 bg-card shadow-card">
          <div className="border-b border-gold/30 bg-gold/5 px-6 py-4">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5 text-gold" />
              <h3 className="font-display text-xl">Confidentiality agreement — {NDA_VERSION}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Required before confidential tiers of opportunities, briefs and data-room material open.</p>
          </div>
          <div className="portal-scroll max-h-96 overflow-y-auto px-6 py-5 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-3"><strong className="text-primary">1. Confidential information.</strong> “Confidential information” means all non-public information disclosed by Murivest Group Ltd (“the Company”) through this portal or otherwise — including opportunity details, financial and underwriting material, lease and tenancy information, data-room documents, briefs, mandate correspondence, and the existence and terms of any engagement — whether marked confidential or not.</p>
            <p className="mb-3"><strong className="text-primary">2. Undertaking.</strong> The recipient shall hold all confidential information in strict confidence, use it solely for evaluating and executing investments with or through the Company, and not disclose it to any third party without prior written consent, except to professional advisers bound by equivalent duties, or as required by law or competent authority.</p>
            <p className="mb-3"><strong className="text-primary">3. Safeguards.</strong> The recipient shall protect confidential information with no less care than applied to their own confidential information, access it only through this portal, and promptly notify the Company of any suspected breach. Access is logged; asset URLs are never exposed. The Company reserves the right to monitor communications through its internal and external networks as previously notified.</p>
            <p className="mb-3"><strong className="text-primary">4. No offer / no advice.</strong> Nothing disclosed constitutes an offer, solicitation, financial advice, or a verified valuation. Figures are indicative and subject to underwriting, contract and due diligence. Murivest does not pool capital or operate collective investment schemes.</p>
            <p className="mb-3"><strong className="text-primary">5. Term.</strong> These obligations survive for two (2) years from acceptance in respect of non-public information, and indefinitely for information designated as a trade secret. This is the Company&apos;s standard portal form; transaction-specific NDAs are executed separately by your advisor where required.</p>
          </div>
          {ndaError ? <div className="border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{ndaError}</div> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Acceptance is recorded with timestamp, IP and device</span>
            <motion.button
              type="button"
              onClick={acceptNda}
              disabled={accepting}
              whileTap={accepting ? undefined : {scale: 0.98}}
              transition={SPRING}
              className="rounded-pill inline-flex items-center gap-2 bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-forest-deep transition-colors hover:bg-gold-deep hover:text-ivory disabled:opacity-60"
            >
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Accept &amp; unlock confidential material
            </motion.button>
          </div>
        </div>
      ) : null}

      {tab === 'room' ? (
        !sanityConfigured ? (
          <EmptyState
            icon={FolderLock}
            title="The data room awaits its first filing"
            body="Investment memoranda, due-diligence packs, financial models, legal documents and transaction files are uploaded by Murivest through the content studio and delivered through this permission-checked, access-logged room. Nothing generic is ever shown here."
          />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title="No documents published at your tier"
            body="Data-room material is permission-gated by access tier and, where granted, by specific document grants from your advisor. Raise your verification tier through onboarding and KYC, or request materials directly below."
            action={
              <button type="button" onClick={() => setTab('requests')} className="press-scale rounded-standard inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                Request documents
              </button>
            }
          />
        ) : (
          /* Reporting-period timeline — soft accordion on a curved gold spine. */
          <div className="relative">
            <motion.div
              aria-hidden="true"
              className="absolute bottom-8 left-[15px] top-8 w-px bg-gradient-to-b from-gold/60 via-gold/30 to-transparent"
              initial={reduce ? undefined : {scaleY: 0}}
              animate={reduce ? undefined : {scaleY: 1}}
              transition={{duration: TIMING.cinematic, ease: EASE}}
              style={{transformOrigin: 'top'}}
            />
            <ol className="space-y-4">
              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.key)
                const downloadableCount = g.docs.filter((d) => d.downloadable).length
                return (
                  <li key={g.key} className="relative pl-10">
                    <span aria-hidden="true" className="absolute left-[10px] top-[26px] z-10 h-[11px] w-[11px] rounded-pill border-2 border-gold bg-background" />
                    <div className="rounded-card border border-border bg-card shadow-card">
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.key)}
                        aria-expanded={!isCollapsed}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-display text-lg leading-tight text-primary">{g.label}</span>
                            <span className="rounded-micro inline-flex items-center bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-secondary-foreground">
                              {g.docs.length} {g.docs.length === 1 ? 'document' : 'documents'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {downloadableCount > 0 ? (
                            <motion.span
                              role="button"
                              tabIndex={0}
                              whileTap={{scale: 0.98}}
                              transition={SPRING}
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadAll(g.docs)
                              }}
                              className="rounded-pill inline-flex cursor-pointer items-center gap-1.5 bg-primary px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                              <FileDown className="h-3.5 w-3.5" /> Download all
                            </motion.span>
                          ) : null}
                          <span className="flex h-8 w-8 items-center justify-center text-muted-foreground">
                            <motion.span animate={{rotate: isCollapsed ? 0 : 180}} transition={SPRING} className="flex">
                              <ChevronDown className="h-4 w-4" strokeWidth={2} />
                            </motion.span>
                          </span>
                        </div>
                      </button>
                      <AnimatePresence initial={false}>
                        {!isCollapsed ? (
                          <motion.div
                            key="content"
                            initial={reduce ? {opacity: 0} : {height: 0, opacity: 0}}
                            animate={reduce ? {opacity: 1} : {height: 'auto', opacity: 1}}
                            exit={reduce ? {opacity: 0} : {height: 0, opacity: 0}}
                            transition={reduce ? {duration: TIMING.micro} : {height: {...SPRING}, opacity: {duration: TIMING.small, ease: EASE}}}
                            className="overflow-hidden"
                          >
                            <ul className="divide-y divide-border border-t border-border">
                              {g.docs.map((d) => (
                                <li key={d.id} className="group flex flex-col gap-3 px-5 py-4 transition-colors duration-200 hover:bg-secondary/50 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex min-w-0 items-start gap-3">
                                    <FileStack className="mt-1 h-5 w-5 flex-shrink-0 text-gold/70" />
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewDoc(d)}
                                        className="truncate text-left font-medium text-primary transition-colors hover:text-gold"
                                      >
                                        {d.title}
                                      </button>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                        <span>{docTypeLabel(d.docType)}</span>
                                        <TierBadge tier={d.accessTier as 'tier_1' | 'tier_2' | 'tier_3'} />
                                        {d.fileExtension ? <span className="uppercase">{d.fileExtension}</span> : null}
                                        {d.fileSize ? <span>{(d.fileSize / 1024 / 1024).toFixed(1)} MB</span> : null}
                                        {d.publishDate ? <span>filed {fmtDate(d.publishDate)}</span> : null}
                                      </div>
                                      {d.description ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{d.description}</p> : null}
                                    </div>
                                  </div>
                                  <div className="flex flex-shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDoc(d)}
                                      className="rounded-standard inline-flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-primary transition-colors hover:bg-accent"
                                    >
                                      <Eye className="h-3.5 w-3.5" /> Preview
                                    </button>
                                    {d.downloadable ? (
                                      <a
                                        href={`/api/documents/${encodeURIComponent(d.id)}/file?download=1`}
                                        rel="noreferrer noopener"
                                        className="rounded-standard inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-primary transition-colors hover:bg-accent"
                                      >
                                        <FileDown className="h-3.5 w-3.5" /> Download
                                      </a>
                                    ) : (
                                      <span
                                        className="rounded-standard inline-flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60"
                                        title="In-portal preview only — the desk controls downloads"
                                      >
                                        Preview only
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Request form */}
          <form onSubmit={submitRequest} className="rounded-card min-w-0 space-y-4 border border-border bg-card p-6 shadow-card">
            <h3 className="font-display text-xl text-primary">Request materials</h3>
            {notice ? <div className="rounded-micro border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs text-primary">{notice}</div> : null}
            {error ? <div className="rounded-micro border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}
            <label className="block">
              <span className={label}>Subject</span>
              <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="e.g. Data room for Westlands office asset" />
            </label>
            <label className="block">
              <span className={label}>Type</span>
              <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="data_room">Data-room access</option>
                <option value="report">Report</option>
                <option value="model">Financial model</option>
                <option value="legal">Legal document</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="block">
              <span className={label}>Detail</span>
              <textarea className={`${input} min-h-24`} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={4000} placeholder="Asset, pack or file you need; intended use; any timing constraints…" />
            </label>
            <motion.button
              type="submit"
              disabled={busy}
              whileTap={busy ? undefined : {scale: 0.98}}
              transition={SPRING}
              className="rounded-pill inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit request
            </motion.button>
          </form>

          {/* Request history */}
          <div className="rounded-card min-w-0 border border-border bg-card p-6 shadow-card">
            <h3 className="mb-4 font-display text-xl text-primary">Your requests</h3>
            {requests.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">No requests yet. Every request is tracked — status, history and delivery appear here and in Activity.</p>
            ) : (
              <ul className="space-y-3">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary">{r.subject}</div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        {humanizeStatus(r.type)} · {relativeTime(r.createdAt)}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Document preview — right-side spring drawer */}
      <MotionDrawer
        open={previewDoc != null}
        onClose={() => setPreviewDoc(null)}
        eyebrow={previewDoc ? docTypeLabel(previewDoc.docType) : undefined}
        title={previewDoc?.title}
        widthClass="max-w-2xl"
        footer={
          previewDoc?.downloadable ? (
            <a
              href={`/api/documents/${encodeURIComponent(previewDoc.id)}/file?download=1`}
              rel="noreferrer noopener"
              className="press-scale rounded-pill inline-flex items-center gap-2 bg-primary px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <FileDown className="h-4 w-4" /> Download this document
            </a>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">In-portal preview only — the desk controls downloads</span>
          )
        }
      >
        {previewDoc ? (
          <div className="space-y-4">
            {previewDoc.description ? <p className="text-sm leading-relaxed text-muted-foreground">{previewDoc.description}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <TierBadge tier={previewDoc.accessTier as 'tier_1' | 'tier_2' | 'tier_3'} />
              {previewDoc.fileExtension ? <span className="uppercase">{previewDoc.fileExtension}</span> : null}
              {previewDoc.fileSize ? <span>{(previewDoc.fileSize / 1024 / 1024).toFixed(1)} MB</span> : null}
              {previewDoc.publishDate ? <span>filed {fmtDate(previewDoc.publishDate)}</span> : null}
            </div>
            <iframe
              src={`/api/documents/${encodeURIComponent(previewDoc.id)}/file`}
              title={`${previewDoc.title} preview`}
              className="min-h-[60vh] w-full rounded-standard border border-border bg-white"
            />
          </div>
        ) : null}
      </MotionDrawer>
    </div>
  )
}
