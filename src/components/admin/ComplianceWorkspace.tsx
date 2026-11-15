'use client'

import {useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Loader2, ShieldAlert} from 'lucide-react'
import {fmtDate, relativeTime} from '@/lib/format'
import {adminAction, inputClass, labelClass} from './client'
import {SectionCard, StatusPill, EmptyState} from './ui'

export interface ComplianceData {
  pending: {userId: string; profileId: string; email: string; fullName: string | null; accountStatus: string; classification: string; verificationStatus: string; kycStatus: string; amlStatus: string; accessTier: string; ndaAccepted: boolean; nationality: string | null; countryResidence: string | null; advisorId: string | null; createdAt: string; updatedAt: string}[]
  ndaGaps: {userId: string; email: string; fullName: string | null; accessTier: string}[]
  docRequests: {id: string; userName: string; subject: string; type: string; status: string; createdAt: string}[]
  flagged: {userId: string; email: string; fullName: string | null; accountStatus: string; amlStatus: string; accessTier: string}[]
  reviews: {id: string; reviewerName: string; decision: string; notes: string | null; createdAt: string}[]
  can: {review: boolean; manage: boolean}
}

export default function ComplianceWorkspace({data}: {data: ComplianceData}) {
  const router = useRouter()
  const {pending, ndaGaps, docRequests, flagged, reviews, can} = data
  const [selectedUserId, setSelectedUserId] = useState(pending[0]?.userId ?? '')
  const [decision, setDecision] = useState('approved')
  const [notes, setNotes] = useState('')
  const [tier, setTier] = useState('')
  const [kyc, setKyc] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selected = pending.find((p) => p.userId === selectedUserId) ?? null

  async function run(action: string, payload: Record<string, unknown>, okMessage: string) {
    setBusy(true)
    setError('')
    setMessage('')
    const res = await adminAction(action, payload)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Action failed.')
      return
    }
    setMessage(okMessage)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {message ? <div className="border border-forest/30 bg-forest/10 px-3 py-2 text-xs text-forest">{message}</div> : null}
      {error ? <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

      {flagged.length > 0 ? (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" /> Risk flags — {flagged.length} account{flagged.length === 1 ? '' : 's'}
          </div>
          <ul className="mt-2 space-y-1">
            {flagged.map((f) => (
              <li key={f.userId} className="flex flex-wrap items-center justify-between gap-2 text-xs text-primary">
                <span>
                  {f.fullName || f.email} · AML {f.amlStatus} · status {f.accountStatus}
                </span>
                <Link href={`/admin/investors/${f.userId}`} className="text-[10px] font-medium uppercase tracking-[0.12em] text-destructive hover:text-primary">
                  Open record →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {/* KYC queue */}
          <SectionCard title="Verification queue" description={`${pending.length} investors in the KYC / verification pipeline`}>
            {pending.length === 0 ? (
              <EmptyState title="Queue is clear" description="No investors are waiting on verification." />
            ) : (
              <ul className="divide-y divide-border/60">
                {pending.map((p) => (
                  <li key={p.userId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(p.userId)
                        setTier(p.accessTier)
                        setKyc(p.kycStatus)
                      }}
                      className={`w-full px-3 py-3 text-left transition-colors hover:bg-accent/30 ${selectedUserId === p.userId ? 'bg-accent/40' : ''}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-primary">{p.fullName || p.email}</span>
                        <span className="text-[10px] text-muted-foreground">waiting since {fmtDate(p.createdAt)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusPill status={p.verificationStatus} />
                        <StatusPill status={p.kycStatus} label={`KYC ${p.kycStatus.replace(/_/g, ' ')}`} />
                        {p.amlStatus !== 'not_started' ? <StatusPill status={p.amlStatus} label={`AML ${p.amlStatus}`} /> : null}
                        <span className="text-[10px] text-muted-foreground">
                          {p.classification === 'uhnwi' ? 'UHNWI' : p.classification === 'institutional_rep' ? 'Institutional' : 'Individual'} · {p.accessTier.replace('_', ' ')} · NDA {p.ndaAccepted ? 'accepted' : 'pending'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {p.nationality ?? 'nationality not stated'} · {p.countryResidence ?? 'residence not stated'} · updated {relativeTime(p.updatedAt)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* NDA tracking */}
          <SectionCard title="NDA acceptance tracking" description="Tier 2/3 investors without a signed NDA are held at Tier 1 visibility">
            {ndaGaps.length === 0 ? (
              <EmptyState title="All confidential-tier investors have signed" description="Investors granted Tier 2/3 must accept the NDA; gaps appear here." />
            ) : (
              <ul className="divide-y divide-border/60">
                {ndaGaps.map((g) => (
                  <li key={g.userId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <Link href={`/admin/investors/${g.userId}`} className="font-medium text-primary hover:text-gold">{g.fullName || g.email}</Link>
                      <div className="text-[10px] text-muted-foreground">{g.accessTier.replace('_', ' ')} granted · NDA pending</div>
                    </div>
                    <StatusPill status="pending" label="NDA pending" />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Recent reviews */}
          <SectionCard title="Recent compliance decisions" description={`${reviews.length} recorded`}>
            {reviews.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reviews recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {reviews.slice(0, 12).map((r) => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <StatusPill status={r.decision === 'approved' ? 'approved' : r.decision === 'rejected' ? 'rejected' : r.decision === 'escalated' ? 'flagged' : 'in_review'} label={r.decision} />
                      <span className="text-[10px] text-muted-foreground">{relativeTime(r.createdAt)} · {r.reviewerName}</span>
                    </div>
                    {r.notes ? <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          {/* Review composer */}
          <SectionCard title="Review & decision" description="Records the decision with a before/after snapshot">
            {!selected ? (
              <EmptyState title="Select an investor" description="Choose someone from the verification queue to record a decision." />
            ) : (
              <div className="space-y-4">
                <div className="border border-border bg-secondary/40 p-3">
                  <div className="text-sm font-medium text-primary">{selected.fullName || selected.email}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{selected.email}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusPill status={selected.verificationStatus} />
                    <StatusPill status={selected.kycStatus} label={`KYC ${selected.kycStatus.replace(/_/g, ' ')}`} />
                  </div>
                </div>
                {can.review ? (
                  <>
                    <div>
                      <label className={labelClass} htmlFor="review-decision">Decision</label>
                      <select id="review-decision" className={inputClass} value={decision} onChange={(e) => setDecision(e.target.value)}>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="escalated">Escalated</option>
                        <option value="note">Note only</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass} htmlFor="review-kyc">Apply KYC status</label>
                        <select id="review-kyc" className={inputClass} value={kyc} onChange={(e) => setKyc(e.target.value)}>
                          <option value="">No change</option>
                          {['not_started', 'submitted', 'in_review', 'approved', 'rejected'].map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="review-tier">Apply access tier</label>
                        <select id="review-tier" className={inputClass} value={tier} onChange={(e) => setTier(e.target.value)}>
                          <option value="">No change</option>
                          {['tier_1', 'tier_2', 'tier_3'].map((s) => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="review-notes">Notes</label>
                      <textarea id="review-notes" className={`${inputClass} min-h-24`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Documents reviewed, risk assessment, conditions…" />
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={busy || !notes.trim()}
                        onClick={() => run('compliance.review', {userId: selected.userId, decision, notes, riskFlags: decision === 'escalated' ? [{flag: 'escalated', severity: 'high'}] : []}, 'Compliance decision recorded.')}
                        className="w-full bg-primary px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
                      >
                        Record decision
                      </button>
                      {can.manage && (kyc || tier) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run('investor.update', {userId: selected.userId, ...(kyc ? {kycStatus: kyc} : {}), ...(tier ? {accessTier: tier} : {}), ...(decision === 'approved' && !kyc ? {kycStatus: 'approved'} : {})}, 'Profile updated — investor notified where relevant.')}
                          className="w-full border border-forest/40 bg-forest/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary disabled:opacity-60"
                        >
                          Apply KYC / tier changes
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">View only — record decisions requires the Compliance role.</p>
                )}
              </div>
            )}
          </SectionCard>

          {/* Document requests pending compliance */}
          <SectionCard title="Document requests" description="Requests touching compliance material">
            {docRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending requests.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {docRequests.slice(0, 8).map((r) => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-primary">{r.subject}</span>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{r.userName} · {r.type.replace(/_/g, ' ')} · {relativeTime(r.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
