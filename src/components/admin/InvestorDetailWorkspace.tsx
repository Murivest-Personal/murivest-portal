'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Loader2, Snowflake, ShieldCheck} from 'lucide-react'
import {fmtDate, fmtDateTime, fmtMoney, fmtNumber, relativeTime} from '@/lib/format'
import {adminAction, inputClass, labelClass} from './client'
import {SectionCard, StatusPill, KeyValue, EmptyState, DataTable} from './ui'

export interface InvestorDetailData {
  user: {id: string; email: string; fullName: string | null; status: string; lastLoginAt: string | null; createdAt: string; emailVerifiedAt: string | null; mfaEnabled: string | boolean; failedLogins: number; lockedUntil: string | null}
  profile: {
    id: string
    classification: string
    verificationStatus: string
    kycStatus: string
    amlStatus: string
    accessTier: string
    ndaAccepted: boolean
    advisorId: string | null
    source: string | null
    notes: string | null
    jobTitle: string | null
    nationality: string | null
    countryResidence: string | null
    phone: string | null
    organisationId: string | null
    capitalCurrency: string
    equityAvailable: number | null
    totalCapacity: number | null
    capitalFloor: number | null
    capitalCeiling: number | null
    onboardingStep: number
    createdAt: string
    updatedAt: string
  }
  organisation: {id: string; name: string; type: string; country: string | null; verified: string | boolean; members: {name: string; email: string; role: string; status: string}[]} | null
  advisor: {id: string; fullName: string | null; email: string} | null
  orders: {id: string; reference: string; briefTitle: string; briefType: string; status: string; amountUsd: number; currency: string; createdAt: string; deliveredAt: string | null}[]
  mandates: {id: string; reference: string; title: string; status: string; stage: string; probability: number; targetAllocationMin: number | null; targetAllocationMax: number | null; currency: string; createdAt: string}[]
  grants: {id: string; sanityDocumentId: string; permission: string; expiresAt: string | null; createdAt: string}[]
  sessions: {id: string; device: string | null; ip: string | null; createdAt: string; lastSeenAt: string; expiresAt: string; revokedAt: string | null}[]
  securityEvents: {id: string; type: string; ip: string | null; createdAt: string}[]
  notes: {id: string; authorName: string; body: string; visibility: string; createdAt: string}[]
  reviews: {id: string; reviewerName: string; decision: string; notes: string | null; createdAt: string}[]
  criteria: unknown | null
  stats: {savedCount: number; scenarioCount: number; enquiriesCount: number}
  auditTrail: {id: string; action: string; entity: string | null; entityId: string | null; actorType: string; ip: string | null; createdAt: string}[]
  advisors: {id: string; name: string; role: string}[]
  can: {manage: boolean; compliance: boolean}
}

export default function InvestorDetailWorkspace({data}: {data: InvestorDetailData}) {
  const router = useRouter()
  const {user, profile, organisation, advisor, orders, mandates, grants, sessions, securityEvents, notes, reviews, stats, auditTrail, advisors, can} = data

  // Verification & relationship controls
  const [verificationStatus, setVerificationStatus] = useState(profile.verificationStatus)
  const [kycStatus, setKycStatus] = useState(profile.kycStatus)
  const [amlStatus, setAmlStatus] = useState(profile.amlStatus)
  const [accessTier, setAccessTier] = useState(profile.accessTier)
  const [advisorId, setAdvisorId] = useState(profile.advisorId ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Compliance review composer
  const [reviewDecision, setReviewDecision] = useState('approved')
  const [reviewNotes, setReviewNotes] = useState('')

  // Internal note composer
  const [noteBody, setNoteBody] = useState('')
  const [noteVisibility, setNoteVisibility] = useState('staff')

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
      {/* Header summary */}
      <div className="rounded-card border border-border bg-card shadow-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl text-primary">{user.fullName || user.email}</h2>
              <StatusPill status={profile.classification === 'uhnwi' ? 'verified' : profile.classification === 'institutional_rep' ? 'in_review' : 'individual'} label={profile.classification === 'institutional_rep' ? 'Institutional' : profile.classification === 'uhnwi' ? 'UHNWI' : 'Individual'} />
              {user.status !== 'active' ? <StatusPill status={user.status} /> : null}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{user.email}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <StatusPill status={profile.verificationStatus} />
              <span>Tier {profile.accessTier.replace('_', ' ')}</span>
              <span>· NDA {profile.ndaAccepted ? 'accepted' : 'pending'}</span>
              <span>· MFA {user.mfaEnabled ? 'on' : 'off'}</span>
              <span>· joined {fmtDate(user.createdAt)}</span>
              <span>· last login {user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'never'}</span>
            </div>
          </div>
          {can.manage ? (
            <div className="flex flex-wrap gap-2">
              {user.status === 'active' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('investor.freeze', {userId: user.id, reason: 'Suspended from investor record'}, 'Account frozen and sessions revoked.')}
                  className="inline-flex items-center gap-1.5 border border-destructive/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  <Snowflake className="h-3 w-3" /> Freeze account
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('investor.unfreeze', {userId: user.id}, 'Account reactivated.')}
                  className="inline-flex items-center gap-1.5 border border-forest/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-forest hover:bg-forest/10 disabled:opacity-60"
                >
                  Reactivate account
                </button>
              )}
            </div>
          ) : null}
        </div>
        {message ? <div className="mt-4 border border-forest/30 bg-forest/10 px-3 py-2 text-xs text-forest">{message}</div> : null}
        {error ? <div className="mt-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {/* Profile facts */}
          <SectionCard title="Profile & stated capacity" description="Self-reported figures; verified during KYC">
            <KeyValue
              items={[
                {label: 'Job title', value: profile.jobTitle ?? '—'},
                {label: 'Nationality', value: profile.nationality ?? '—'},
                {label: 'Residence', value: profile.countryResidence ?? '—'},
                {label: 'Phone', value: profile.phone ?? '—'},
                {label: 'Equity available', value: profile.equityAvailable != null ? fmtMoney(profile.equityAvailable, profile.capitalCurrency) : '—'},
                {label: 'Total capacity', value: profile.totalCapacity != null ? fmtMoney(profile.totalCapacity, profile.capitalCurrency) : '—'},
                {label: 'Ticket range', value: profile.capitalFloor != null || profile.capitalCeiling != null ? `${profile.capitalFloor != null ? fmtMoney(profile.capitalFloor, profile.capitalCurrency, {compact: true}) : '—'} → ${profile.capitalCeiling != null ? fmtMoney(profile.capitalCeiling, profile.capitalCurrency, {compact: true}) : '—'}` : '—'},
                {label: 'Source', value: profile.source ?? '—'},
                {label: 'Onboarding step', value: `${profile.onboardingStep} of 11`},
                {label: 'Organisation', value: organisation ? `${organisation.name}${organisation.verified === true || organisation.verified === 'true' ? ' · verified' : ''}` : '—'},
                {label: 'Advisor', value: advisor ? advisor.fullName || advisor.email : 'Unassigned'},
                {label: 'Saved opportunities', value: fmtNumber(stats.savedCount)},
              ]}
            />
          </SectionCard>

          {/* Orders */}
          <SectionCard title="Orders" description={`${orders.length} total`}>
            {orders.length === 0 ? (
              <EmptyState title="No orders yet" description="Brief orders placed by this investor will appear here." />
            ) : (
              <DataTable head={['Reference', 'Brief', 'Status', 'Amount', 'Placed']}>
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td className="pl-0 pr-3">
                      <a href={`/admin/orders/${o.id}`} className="font-medium text-primary hover:text-gold">{o.reference}</a>
                    </td>
                    <td className="px-3 text-xs">{o.briefTitle}</td>
                    <td className="px-3"><StatusPill status={o.status} /></td>
                    <td className="px-3 text-xs tabular-nums">{fmtMoney(o.amountUsd, o.currency === 'KES' ? 'KES' : 'USD', {compact: true})}</td>
                    <td className="px-3 text-xs text-muted-foreground">{relativeTime(o.createdAt)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>

          {/* Mandates */}
          <SectionCard title="Mandates" description={`${mandates.length} total`}>
            {mandates.length === 0 ? (
              <EmptyState title="No mandates" description="Acquisition mandates submitted by this investor will appear here." />
            ) : (
              <DataTable head={['Reference', 'Title', 'Stage', 'Allocation', 'Status']}>
                {mandates.slice(0, 6).map((m) => (
                  <tr key={m.id}>
                    <td className="pl-0 pr-3 text-xs font-medium text-primary">{m.reference}</td>
                    <td className="px-3 text-xs">{m.title}</td>
                    <td className="px-3"><StatusPill status={m.stage} /> <span className="ml-1 text-[10px] text-muted-foreground">{m.probability}%</span></td>
                    <td className="px-3 text-xs tabular-nums">
                      {m.targetAllocationMin != null || m.targetAllocationMax != null
                        ? `${m.targetAllocationMin != null ? fmtMoney(m.targetAllocationMin, m.currency, {compact: true}) : '—'} → ${m.targetAllocationMax != null ? fmtMoney(m.targetAllocationMax, m.currency, {compact: true}) : '—'}`
                        : '—'}
                    </td>
                    <td className="px-3"><StatusPill status={m.status} /></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>

          {/* Activity timeline */}
          <SectionCard title="Activity timeline" description="Audit-logged actions (latest 40)">
            {auditTrail.length === 0 ? (
              <EmptyState title="No logged activity yet" />
            ) : (
              <ul className="divide-y divide-border/60">
                {auditTrail.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs text-primary">{a.action.replace(/\./g, ' → ')}</div>
                      <div className="text-[10px] text-muted-foreground">{a.entity ?? 'system'} · {a.actorType}{a.ip ? ` · ${a.ip}` : ''}</div>
                    </div>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">{relativeTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          {/* Verification & tier management */}
          <SectionCard title="Verification & access" description={can.manage ? 'Compliance-grade controls — every change is recorded' : 'View only — Compliance manages verification'}>
            {can.manage ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="verification">Verification</label>
                    <select id="verification" className={inputClass} value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)}>
                      {['unverified', 'email_verified', 'profile_submitted', 'kyc_pending', 'in_review', 'verified', 'rejected'].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="kyc">KYC</label>
                    <select id="kyc" className={inputClass} value={kycStatus} onChange={(e) => setKycStatus(e.target.value)}>
                      {['not_started', 'submitted', 'in_review', 'approved', 'rejected'].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="aml">AML</label>
                    <select id="aml" className={inputClass} value={amlStatus} onChange={(e) => setAmlStatus(e.target.value)}>
                      {['not_started', 'clear', 'flagged'].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="tier">Access tier</label>
                    <select id="tier" className={inputClass} value={accessTier} onChange={(e) => setAccessTier(e.target.value)}>
                      {['tier_1', 'tier_2', 'tier_3'].map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="advisor">Assigned advisor</label>
                  <select id="advisor" className={inputClass} value={advisorId} onChange={(e) => setAdvisorId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {advisors.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('investor.update', {userId: user.id, verificationStatus, kycStatus, amlStatus, accessTier, advisorId: advisorId || null}, 'Verification, tier and advisor updated. The investor was notified where relevant.')}
                  className="inline-flex w-full items-center justify-center gap-2 bg-primary px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Apply changes
                </button>
              </div>
            ) : (
              <KeyValue
                items={[
                  {label: 'Verification', value: <StatusPill status={profile.verificationStatus} />},
                  {label: 'KYC', value: <StatusPill status={profile.kycStatus} />},
                  {label: 'AML', value: <StatusPill status={profile.amlStatus} />},
                  {label: 'Access tier', value: profile.accessTier.replace('_', ' ')},
                ]}
              />
            )}
          </SectionCard>

          {/* Compliance review record */}
          {can.compliance ? (
            <SectionCard title="Record compliance decision" description="Logged to the compliance history with a before/after snapshot">
              <div className="space-y-3">
                <div>
                  <label className={labelClass} htmlFor="decision">Decision</label>
                  <select id="decision" className={inputClass} value={reviewDecision} onChange={(e) => setReviewDecision(e.target.value)}>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="escalated">Escalated</option>
                    <option value="note">Note only</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="review-notes">Notes / risk flags</label>
                  <textarea id="review-notes" className={`${inputClass} min-h-20`} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Documents reviewed, risk assessment, follow-ups…" />
                </div>
                <button
                  type="button"
                  disabled={busy || !reviewNotes.trim()}
                  onClick={() => run('compliance.review', {userId: user.id, decision: reviewDecision, notes: reviewNotes}, 'Compliance decision recorded.')}
                  className="w-full border border-forest/40 bg-forest/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary disabled:opacity-60"
                >
                  Record decision
                </button>
              </div>
            </SectionCard>
          ) : null}

          {/* Internal notes */}
          <SectionCard title="Internal notes" description="Staff-only — never visible to the investor">
            <div className="space-y-3">
              <textarea className={`${inputClass} min-h-20`} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Relationship context, sensitivities, follow-ups…" aria-label="New internal note" />
              <div className="flex items-center gap-2">
                <select className={inputClass} value={noteVisibility} onChange={(e) => setNoteVisibility(e.target.value)} aria-label="Note visibility" disabled={noteVisibility === 'admins' && !can.compliance}>
                  <option value="staff">All staff</option>
                  <option value="admins">Super admins only</option>
                </select>
                <button
                  type="button"
                  disabled={busy || !noteBody.trim()}
                  onClick={() => run('note.create', {entityType: 'investor', entityId: user.id, body: noteBody, visibility: noteVisibility}, 'Note added.').then(() => setNoteBody(''))}
                  className="whitespace-nowrap bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
                >
                  Add note
                </button>
              </div>
              {notes.length === 0 ? (
                <p className="pt-2 text-xs text-muted-foreground">No internal notes yet.</p>
              ) : (
                <ul className="space-y-3 pt-2">
                  {notes.map((n) => (
                    <li key={n.id} className="border border-border/60 bg-secondary/40 p-3">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        <span>{n.authorName} · {n.visibility === 'admins' ? 'admins only' : 'staff'}</span>
                        <span>{fmtDate(n.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-primary">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>

          {/* Compliance history */}
          <SectionCard title="Compliance history" description={`${reviews.length} reviews`}>
            {reviews.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reviews recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {reviews.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <StatusPill status={r.decision === 'approved' ? 'approved' : r.decision === 'rejected' ? 'rejected' : r.decision === 'escalated' ? 'flagged' : 'in_review'} label={r.decision} />
                      <span className="text-[10px] text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                    </div>
                    {r.notes ? <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p> : null}
                    <div className="mt-0.5 text-[10px] text-muted-foreground">by {r.reviewerName}</div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Sessions & security */}
          <SectionCard title="Sessions & security" description={`${securityEvents.length} recent events`}>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sessions recorded.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {sessions.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-primary">{s.device ?? 'Unknown device'}</span>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {s.revokedAt ? 'revoked' : s.expiresAt < new Date().toISOString() ? 'expired' : 'active'} · {relativeTime(s.lastSeenAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {securityEvents.length > 0 ? (
              <ul className="space-y-1 border-t border-border pt-3">
                {securityEvents.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{e.type.replace(/_/g, ' ')}{e.ip ? ` · ${e.ip}` : ''}</span>
                    <span>{relativeTime(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          {/* Data room grants */}
          <SectionCard title="Data room grants" description={`${grants.length} documents`}>
            {grants.length === 0 ? (
              <p className="text-xs text-muted-foreground">No documents granted yet.</p>
            ) : (
              <ul className="space-y-2">
                {grants.slice(0, 8).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-primary">{g.sanityDocumentId}</span>
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {g.permission} · {g.expiresAt ? `expires ${fmtDate(g.expiresAt)}` : 'no expiry'} · {relativeTime(g.createdAt)}
                    </span>
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
