'use client'

import {useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Loader2, Download} from 'lucide-react'
import {fmtDateTime, fmtMoney, relativeTime} from '@/lib/format'
import {adminAction, inputClass, labelClass} from './client'
import {SectionCard, StatusPill, KeyValue, EmptyState} from './ui'

export interface OrderDetailData {
  order: {
    id: string
    reference: string
    userId: string
    briefSource: string
    sanityBriefId: string | null
    sanityOpportunityId: string | null
    briefTitle: string
    briefType: string
    format: string
    customScope: string | null
    amountKes: number
    amountUsd: number
    currency: string
    status: string
    priority: string
    assignedToId: string | null
    advisorId: string | null
    paymentMethod: string | null
    transactionId: string | null
    contactName: string | null
    contactEmail: string | null
    organisation: string | null
    shippingAddress: string | null
    phone: string | null
    deliveryMethod: string | null
    trackingNumber: string | null
    deliveryDocumentId: string | null
    dueAt: string | null
    deliveredAt: string | null
    closedAt: string | null
    cancelledAt: string | null
    cancellationReason: string | null
    createdAt: string
  }
  investor: {
    user: {id: string; fullName: string | null; email: string; status: string} | null
    profile: {classification: string; accessTier: string; verificationStatus: string; advisorId: string | null; countryResidence: string | null; totalCapacity: number | null; capitalCurrency: string} | null
  }
  payments: {id: string; method: string; amountKes: number; amountUsd: number; currency: string; reference: string | null; confirmationRaw: string | null; status: string; verifiedAt: string | null; note: string | null; createdAt: string}[]
  events: {id: string; fromStatus: string | null; toStatus: string; changedByName: string; note: string | null; createdAt: string}[]
  notes: {id: string; authorName: string; body: string; visibility: string; createdAt: string}[]
  refunds: {id: string; amountUsd: number; amountKes: number; reason: string; status: string; requestedByName: string; reviewedByName: string | null; createdAt: string}[]
  revenue: {grossUsd: number; grossKes: number; processingUsd: number; refundUsd: number; netUsd: number; recognisedAt: string} | null
  assignment: {assignedToName: string | null; advisorName: string | null}
  staff: {id: string; name: string}[]
  can: {manage: boolean; verifyPayments: boolean; refunds: boolean}
}

const NEXT_STATUS: Record<string, string[]> = {
  pending: ['awaiting_payment', 'payment_confirmed', 'cancelled'],
  awaiting_payment: ['payment_confirmed', 'cancelled'],
  payment_confirmed: ['processing', 'cancelled'],
  processing: ['internal_review', 'ready', 'cancelled'],
  internal_review: ['ready', 'processing'],
  ready: ['delivered', 'cancelled'],
  delivered: ['closed'],
  closed: [],
  cancelled: [],
}

export default function OrderDetailWorkspace({data}: {data: OrderDetailData}) {
  const router = useRouter()
  const {order, investor, payments, events, notes, refunds, revenue, assignment, staff, can} = data
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [noteBody, setNoteBody] = useState('')

  const [assignedToId, setAssignedToId] = useState(order.assignedToId ?? '')
  const [priority, setPriority] = useState(order.priority)
  const [dueAt, setDueAt] = useState(order.dueAt ? order.dueAt.slice(0, 10) : '')
  const [advisorId, setAdvisorId] = useState(order.advisorId ?? '')
  const [deliveryDocumentId, setDeliveryDocumentId] = useState(order.deliveryDocumentId ?? '')

  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  const [paymentNote, setPaymentNote] = useState('')

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

  const nextStatuses = NEXT_STATUS[order.status] ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-card border border-border bg-card shadow-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl text-primary">{order.reference}</h2>
              <StatusPill status={order.status} />
              {order.priority !== 'normal' ? <StatusPill status={order.priority === 'urgent' ? 'flagged' : 'under_offer'} label={order.priority} /> : null}
              <StatusPill status={order.briefType === 'institutional_brief' ? 'in_review' : 'processing'} label={order.briefType.replace(/_/g, ' ')} />
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{order.briefTitle}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {order.briefSource.replace(/_/g, ' ')} · {order.format.replace(/_/g, ' ')} · placed {fmtDateTime(order.createdAt)}
              {order.sanityOpportunityId ? ` · opportunity ${order.sanityOpportunityId}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl text-primary tabular-nums">{fmtMoney(order.amountUsd, 'USD')}</div>
            <div className="text-[10px] text-muted-foreground">{fmtMoney(order.amountKes, 'KES')}</div>
          </div>
        </div>

        {message ? <div className="mt-4 border border-forest/30 bg-forest/10 px-3 py-2 text-xs text-forest">{message}</div> : null}
        {error ? <div className="mt-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

        {/* Lifecycle workflow */}
        {can.manage ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Advance status:</span>
            {nextStatuses.length === 0 ? (
              <span className="text-xs text-muted-foreground">Terminal status — no transitions available.</span>
            ) : (
              nextStatuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => run('order.status', {orderId: order.id, status: s}, `Status advanced to ${s.replace(/_/g, ' ')}.`)}
                  className={
                    s === 'cancelled'
                      ? 'border border-destructive/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-destructive hover:bg-destructive/10 disabled:opacity-60'
                      : 'border border-gold/40 bg-gold/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:border-gold disabled:opacity-60'
                  }
                >
                  {busy ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
                  {s.replace(/_/g, ' ')}
                </button>
              ))
            )}
            {order.status === 'ready' ? (
              <div className="flex w-full items-center gap-2 pt-2">
                <input
                  className="rounded-standard border border-border bg-background px-3 py-1.5 text-xs focus:border-primary"
                  placeholder="Sanity document id to deliver into data room (optional)"
                  value={deliveryDocumentId}
                  onChange={(e) => setDeliveryDocumentId(e.target.value)}
                  aria-label="Delivery document id"
                />
                <span className="text-[10px] text-muted-foreground">Delivering with a document id grants the investor secure access automatically.</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          {/* Payments & reconciliation */}
          <SectionCard title="Payment reconciliation" description="Verified payments unlock fulfilment and revenue recognition">
            {payments.length === 0 ? (
              <EmptyState title="No payments submitted" description="The investor has not yet submitted payment evidence for this order." />
            ) : (
              <ul className="space-y-3">
                {payments.map((p) => (
                  <li key={p.id} className="border border-border p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusPill status={p.status === 'verified' ? 'verified' : p.status === 'rejected' ? 'rejected' : 'pending'} label={p.status} />
                        <span className="text-xs font-medium text-primary">{fmtMoney(p.amountUsd, 'USD')}</span>
                        <span className="text-[10px] text-muted-foreground">{fmtMoney(p.amountKes, 'KES')} · {p.method}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{fmtDateTime(p.createdAt)}{p.verifiedAt ? ` · verified ${fmtDateTime(p.verifiedAt)}` : ''}</span>
                    </div>
                    {p.reference ? <div className="mt-2 text-xs text-muted-foreground">Ref: {p.reference}</div> : null}
                    {p.confirmationRaw ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary">Pasted confirmation</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-all bg-secondary/50 p-2 text-[10px] leading-relaxed text-primary">{p.confirmationRaw}</pre>
                      </details>
                    ) : null}
                    {can.verifyPayments && p.status === 'submitted' ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          className="min-w-48 flex-1 rounded-standard border border-border bg-background px-3 py-1.5 text-xs focus:border-primary"
                          placeholder="Verification note (optional)"
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          aria-label="Payment verification note"
                        />
                        <button type="button" disabled={busy} onClick={() => run('payment.verify', {paymentId: p.id, decision: 'verified', note: paymentNote}, 'Payment verified — order moved to payment confirmed.')} className="border border-forest/40 bg-forest/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60">
                          Verify
                        </button>
                        <button type="button" disabled={busy} onClick={() => run('payment.verify', {paymentId: p.id, decision: 'rejected', note: paymentNote}, 'Payment rejected — investor notified.')} className="border border-destructive/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-destructive disabled:opacity-60">
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {/* Revenue recognition state */}
            {revenue ? (
              <div className="mt-4 border border-forest/30 bg-forest/5 p-3.5">
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Revenue recognised</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-primary">
                  <span className="font-display text-lg tabular-nums">{fmtMoney(revenue.grossUsd, 'USD')} gross</span>
                  <span className="tabular-nums text-muted-foreground">− {fmtMoney(revenue.processingUsd)} costs − {fmtMoney(revenue.refundUsd)} refunds</span>
                  <span className="font-medium tabular-nums">= {fmtMoney(revenue.netUsd)} net</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">recognised {fmtDateTime(revenue.recognisedAt)} · KES gross {fmtMoney(revenue.grossKes, 'KES')}</div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Revenue is recognised automatically when the order is delivered with a verified payment.
              </p>
            )}
          </SectionCard>

          {/* Refunds */}
          {can.refunds ? (
            <SectionCard title="Refunds & adjustments" description="Controlled — proposals require Finance review and flow into the revenue ledger">
              <div className="mb-4 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                <input className={inputClass} type="number" min="0" step="0.01" placeholder="USD amount" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} aria-label="Refund amount USD" />
                <input className={inputClass} placeholder="Reason (required, shown to the investor)" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} aria-label="Refund reason" />
                <button
                  type="button"
                  disabled={busy || !refundAmount || !refundReason.trim()}
                  onClick={async () => {
                    const okRun = await run('refund.propose', {orderId: order.id, amountUsd: Number(refundAmount), reason: refundReason}, 'Refund proposed — awaiting review.')
                    if (okRun) {
                      setRefundAmount('')
                      setRefundReason('')
                    }
                  }}
                  className="whitespace-nowrap bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
                >
                  Propose refund
                </button>
              </div>
              {refunds.length === 0 ? (
                <p className="text-xs text-muted-foreground">No refunds or adjustments on this order.</p>
              ) : (
                <ul className="space-y-2">
                  {refunds.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border border-border p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusPill status={r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending'} label={r.status} />
                          <span className="text-xs font-medium tabular-nums text-primary">{fmtMoney(r.amountUsd, 'USD')}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{r.reason} · proposed by {r.requestedByName} {relativeTime(r.createdAt)}</div>
                      </div>
                      {r.status === 'proposed' ? (
                        <div className="flex gap-1.5">
                          <button type="button" disabled={busy} onClick={() => run('refund.review', {refundId: r.id, decision: 'approved'}, 'Refund approved and applied to the ledger.')} className="border border-forest/40 bg-forest/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60">
                            Approve
                          </button>
                          <button type="button" disabled={busy} onClick={() => run('refund.review', {refundId: r.id, decision: 'rejected'}, 'Refund rejected.')} className="border border-destructive/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-destructive disabled:opacity-60">
                            Reject
                          </button>
                        </div>
                      ) : r.reviewedByName ? (
                        <span className="text-[10px] text-muted-foreground">reviewed by {r.reviewedByName}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ) : null}

          {/* Lifecycle history */}
          <SectionCard title="Lifecycle history" description={`${events.length} recorded transitions`}>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">No transitions recorded yet.</p>
            ) : (
              <ol className="relative ml-2 space-y-4 border-l border-border pl-5">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 border border-gold bg-background" aria-hidden="true" />
                    <div className="flex flex-wrap items-center gap-2">
                      {e.fromStatus ? <StatusPill status={e.fromStatus} /> : null}
                      {e.fromStatus ? <span className="text-[10px] text-muted-foreground">→</span> : null}
                      <StatusPill status={e.toStatus} />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {e.changedByName} · {fmtDateTime(e.createdAt)}{e.note ? ` · ${e.note}` : ''}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          {/* Investor snapshot */}
          <SectionCard title="Investor" description="Ordering party">
            {investor.user ? (
              <>
                <Link href={`/admin/investors/${investor.user.id}`} className="font-medium text-primary hover:text-gold">
                  {investor.user.fullName || investor.user.email}
                </Link>
                <div className="mt-2">
                  <KeyValue
                    items={[
                      {label: 'Email', value: investor.user.email},
                      {label: 'Classification', value: investor.profile?.classification === 'uhnwi' ? 'UHNWI' : investor.profile?.classification === 'institutional_rep' ? 'Institutional' : 'Individual'},
                      {label: 'Tier', value: investor.profile?.accessTier.replace('_', ' ') ?? '—'},
                      {label: 'Verification', value: investor.profile ? <StatusPill status={investor.profile.verificationStatus} /> : '—'},
                      {label: 'Capacity', value: investor.profile?.totalCapacity != null ? fmtMoney(investor.profile.totalCapacity, investor.profile.capitalCurrency) : '—'},
                      {label: 'Delivery contact', value: order.contactName ?? '—'},
                      {label: 'Delivery email', value: order.contactEmail ?? '—'},
                      {label: 'Shipping', value: order.shippingAddress ?? (order.deliveryMethod ? order.deliveryMethod.replace(/_/g, ' ') : '—')},
                      {label: 'Tracking', value: order.trackingNumber ?? '—'},
                    ]}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Investor account no longer exists.</p>
            )}
          </SectionCard>

          {/* Fulfilment assignment */}
          {can.manage ? (
            <SectionCard title="Fulfilment & attribution" description="Assignment, priority, due date and revenue attribution">
              <div className="space-y-3">
                <div>
                  <label className={labelClass} htmlFor="assignee">Assigned to</label>
                  <select id="assignee" className={inputClass} value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="priority">Priority</label>
                    <select id="priority" className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                      {['low', 'normal', 'high', 'urgent'].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="due">Due date</label>
                    <input id="due" type="date" className={inputClass} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="attribution">Advisor attribution (revenue)</label>
                  <select id="attribution" className={inputClass} value={advisorId} onChange={(e) => setAdvisorId(e.target.value)}>
                    <option value="">Follow investor&apos;s advisor</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run('order.update', {orderId: order.id, assignedToId: assignedToId || null, priority, dueAt: dueAt || null, advisorId: advisorId || null}, 'Fulfilment details updated.')}
                  className="w-full bg-primary px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
                >
                  Save fulfilment details
                </button>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Current: {assignment.assignedToName ?? 'unassigned'} · attribution {assignment.advisorName ?? 'investor advisor'}.
                </p>
              </div>
            </SectionCard>
          ) : null}

          {/* Internal notes */}
          <SectionCard title="Internal notes" description="Staff-only">
            <div className="space-y-3">
              <textarea className={`${inputClass} min-h-20`} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Underwriting notes, scope clarifications…" aria-label="New note" />
              <button
                type="button"
                disabled={busy || !noteBody.trim()}
                onClick={async () => {
                  const okRun = await run('note.create', {entityType: 'order', entityId: order.id, body: noteBody}, 'Note added.')
                  if (okRun) setNoteBody('')
                }}
                className="bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
              >
                Add note
              </button>
              {notes.length > 0 ? (
                <ul className="space-y-3 pt-1">
                  {notes.map((n) => (
                    <li key={n.id} className="border border-border/60 bg-secondary/40 p-3">
                      <div className="flex justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        <span>{n.authorName}</span>
                        <span>{fmtDateTime(n.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-primary">{n.body}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </SectionCard>

          {/* Export */}
          {can.manage ? (
            <SectionCard title="Order record" description="For files and audit">
              <KeyValue
                items={[
                  {label: 'Sanity brief', value: order.sanityBriefId ?? 'custom scope'},
                  {label: 'Custom scope', value: order.customScope ? order.customScope.slice(0, 140) + (order.customScope.length > 140 ? '…' : '') : '—'},
                  {label: 'Payment method', value: order.paymentMethod ?? '—'},
                  {label: 'Transaction', value: order.transactionId ?? '—'},
                  {label: 'Delivered', value: order.deliveredAt ? fmtDateTime(order.deliveredAt) : '—'},
                  {label: 'Closed', value: order.closedAt ? fmtDateTime(order.closedAt) : '—'},
                ]}
              />
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  )
}
