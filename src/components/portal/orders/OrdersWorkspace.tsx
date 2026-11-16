'use client'

import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {
  BookOpen,
  CreditCard,
  Loader2,
  Package,
  Printer,
  Smartphone,
  Truck,
  XCircle,
  Building2,
  ArrowRight,
  X,
} from 'lucide-react'
import type {BriefDoc} from '@/lib/sanity/types'
import {fmtMoney, fmtDate, relativeTime, humanizeStatus} from '@/lib/format'
import {StatusBadge, EmptyState, TierBadge} from '@/components/brand/primitives'
import PortableBlocks from '@/components/portal/PortableBlocks'
import {MPESA} from '@/lib/constants'
import {cn} from '@/lib/utils'

const input = 'w-full rounded-standard border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground'

export interface OrderRow {
  id: string
  reference: string
  briefTitle: string
  briefType: string
  briefSource: string
  format: string
  status: string
  amountKes: number
  amountUsd: number
  currency: string
  paymentMethod: string | null
  transactionId: string | null
  trackingNumber: string | null
  shippingAddress: string | null
  phone: string | null
  contactName: string | null
  contactEmail: string | null
  createdAt: string
  deliveredAt: string | null
  customScope: string | null
}

interface Props {
  briefs: BriefDoc[]
  orders: OrderRow[]
  sanityConfigured: boolean
  preselectOpportunity?: string | null
}

export default function OrdersWorkspace({briefs, orders, sanityConfigured, preselectOpportunity}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'catalog' | 'custom' | 'orders'>(preselectOpportunity ? 'custom' : 'catalog')
  const [ordering, setOrdering] = useState<BriefDoc | null>(null)
  const [format, setFormat] = useState<'digital' | 'hard_copy'>('digital')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'wire' | 'card'>('mpesa')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [placedOrder, setPlacedOrder] = useState<OrderRow | null>(null)
  const [payModal, setPayModal] = useState<OrderRow | null>(null)
  const [mpesaMessage, setMpesaMessage] = useState('')
  const [wireRef, setWireRef] = useState('')
  const [payError, setPayError] = useState('')
  const [payBusy, setPayBusy] = useState(false)
  const [payNotice, setPayNotice] = useState('')

  // Custom brief request state
  const [customTitle, setCustomTitle] = useState('')
  const [customScope, setCustomScope] = useState('')
  const [customSource, setCustomSource] = useState<'catalog' | 'auction' | 'off_market' | 'custom'>('custom')
  const [customNotice, setCustomNotice] = useState('')

  // While any overlay is open: lock the page scroll beneath it and close on Escape.
  const overlayOpen = Boolean(ordering || payModal)
  useEffect(() => {
    if (!overlayOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOrdering(null)
        setPayModal(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [overlayOpen])
  const [customError, setCustomError] = useState('')

  function openOrder(b: BriefDoc) {
    setOrdering(b)
    setFormat('digital')
    setAddress('')
    setError('')
    setPaymentMethod(b.pricing?.digitalKes || b.pricing?.digitalUsd ? 'mpesa' : 'mpesa')
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!ordering) return
    if (format === 'hard_copy' && !address.trim()) {
      setError('A courier delivery address is required for hard-copy briefs.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const amountKes = format === 'digital' ? ordering.pricing?.digitalKes ?? 0 : ordering.pricing?.hardKes ?? 0
      const amountUsd = format === 'digital' ? ordering.pricing?.digitalUsd ?? 0 : ordering.pricing?.hardUsd ?? 0
      const payable = amountKes > 0 || amountUsd > 0
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          sanityBriefId: ordering._id,
          briefTitle: ordering.title,
          briefType: ordering.briefType,
          briefSource: ordering.linkedOpportunity?._ref ? 'catalog' : ordering.auctionRef ? 'auction' : 'catalog',
          format,
          amountKes,
          amountUsd,
          currency: 'KES',
          paymentMethod: payable ? paymentMethod : null,
          shippingAddress: format === 'hard_copy' ? address.trim() : null,
          phone: phone.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not place the order.')
        return
      }
      setPlacedOrder(data.order)
      setOrdering(null)
      if (payable) setPayModal(data.order)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payModal) return
    setPayBusy(true)
    setPayError('')
    try {
      const body =
        payModal.paymentMethod === 'mpesa'
          ? {method: 'mpesa', orderId: payModal.id, mpesaMessage}
          : {method: 'wire', orderId: payModal.id, bankReference: wireRef}
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setPayError(data.error || 'Payment submission failed.')
        return
      }
      setPayNotice('Confirmation received. Murivest finance verifies every payment before preparation begins — you will be notified at each step.')
      setMpesaMessage('')
      setWireRef('')
      setPayModal(null)
      router.refresh()
    } catch {
      setPayError('Network error — please try again.')
    } finally {
      setPayBusy(false)
    }
  }

  async function cancelOrder(order: OrderRow) {
    if (!window.confirm(`Cancel order ${order.reference}? This cannot be undone.`)) return
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({reason: 'Cancelled by investor'}),
    }).catch(() => null)
    if (res && res.ok) router.refresh()
  }

  function printReceipt(order: OrderRow) {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    w.document.write(`<!doctype html><html><head><title>Receipt ${esc(order.reference)}</title>
      <style>
        body{font-family:Georgia,serif;color:#1c2b23;padding:40px;max-width:640px;margin:auto}
        h1{font-size:22px;margin:0 0 4px;color:#1B4332}
        .muted{color:#6d7a6f;font-size:12px}
        .brand{letter-spacing:.08em;font-weight:600;font-size:18px;color:#1B4332}
        table{width:100%;border-collapse:collapse;margin-top:24px;font-size:14px}
        td{padding:8px 0;border-bottom:1px solid #e3ded2;vertical-align:top}
        td:first-child{color:#6d7a6f;width:38%}
        .gold{height:1px;background:#B8956B;margin:12px 0}
      </style></head><body>
      <div class="brand">MURIVEST</div><div class="muted">Private Capital Portal · Order receipt</div>
      <div class="gold"></div>
      <table>
        <tr><td>Reference</td><td>${esc(order.reference)}</td></tr>
        <tr><td>Brief</td><td>${esc(order.briefTitle)}</td></tr>
        <tr><td>Type</td><td>${esc(humanizeStatus(order.briefType))} · ${order.format === 'digital' ? 'Digital edition' : 'Hard copy'}</td></tr>
        <tr><td>Ordered</td><td>${esc(fmtDate(order.createdAt))}</td></tr>
        <tr><td>Status</td><td>${esc(humanizeStatus(order.status))}</td></tr>
        <tr><td>Recipient</td><td>${esc(order.contactName)}<br/>${esc(order.contactEmail)}${order.phone ? `<br/>${esc(order.phone)}` : ''}</td></tr>
        ${order.shippingAddress ? `<tr><td>Delivery</td><td>${esc(order.shippingAddress)}</td></tr>` : ''}
        <tr><td>Payment method</td><td>${esc(humanizeStatus(order.paymentMethod || 'n/a'))}</td></tr>
        <tr><td>Transaction</td><td>${esc(order.transactionId || '—')}</td></tr>
        <tr><td>Amount</td><td>${order.amountKes > 0 ? `KES ${order.amountKes.toLocaleString()}` : 'Complimentary'}${order.amountUsd > 0 ? ` ($${order.amountUsd})` : ''}</td></tr>
        <tr><td>Tracking</td><td>${esc(order.trackingNumber || '—')}</td></tr>
      </table>
      <p class="muted" style="margin-top:28px">All engagements are mandate-only under fiduciary standards. This receipt is generated by the Murivest Private Capital Portal.</p>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`)
    w.document.close()
  }

  async function submitCustomRequest(e: React.FormEvent) {
    e.preventDefault()
    if (customTitle.trim().length < 3 || customScope.trim().length < 20) {
      setCustomError('Provide a working title and a scope of at least 20 characters.')
      return
    }
    setBusy(true)
    setCustomError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          briefTitle: customTitle.trim(),
          briefType: 'custom',
          briefSource: customSource,
          format: 'digital',
          amountKes: 0,
          amountUsd: 0,
          currency: 'KES',
          sanityOpportunityId: preselectOpportunity || null,
          customScope: customScope.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setCustomError(data.error || 'Could not submit the request.')
        return
      }
      setCustomNotice(`Request ${data.order.reference} submitted. Your advisor will respond with scoping and pricing for confirmation before any work begins.`)
      setCustomTitle('')
      setCustomScope('')
      router.refresh()
    } catch {
      setCustomError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 grid grid-cols-3 border border-border bg-card text-center text-[11px] uppercase tracking-[0.14em]">
        {(
          [
            ['catalog', 'Brief catalogue'],
            ['custom', 'Custom brief request'],
            ['orders', `My orders (${orders.length})`],
          ] as const
        ).map(([key, lbl]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn('px-2 py-3 transition-colors', tab === key ? 'bg-gold/10 font-semibold text-primary' : 'text-muted-foreground hover:text-primary')}>
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'catalog' ? (
        !sanityConfigured ? (
          <EmptyState
            icon={BookOpen}
            title="The brief catalogue awaits publication"
            body="Institutional brief products — scope, delivery expectations and pricing — are published by Murivest through the content studio. Until the catalogue goes live, submit a custom brief request and the desk will scope it directly with you."
            action={
              <button type="button" onClick={() => setTab('custom')} className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep">
                Request a custom brief <ArrowRight className="h-3.5 w-3.5" />
              </button>
            }
          />
        ) : briefs.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No briefs published at your tier"
            body="Brief products visible to you are permission-filtered. Raise your verification tier through KYC, or request a custom institutional brief on any opportunity, including auction inventory from auctions.murivest.com."
            action={
              <button type="button" onClick={() => setTab('custom')} className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                Custom brief request
              </button>
            }
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {briefs.map((b) => (
              <article key={b._id} className="flex flex-col rounded-card border border-border bg-card shadow-card p-6 transition-colors hover:border-gold/40">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary-foreground">
                    {b.briefType === 'institutional_brief' ? 'Institutional brief' : 'Private brief'}
                  </span>
                  <TierBadge tier={b.accessTier} />
                  {b.auctionRef ? <span className="inline-flex items-center bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-primary">Auction · {b.auctionRef}</span> : null}
                </div>
                <h3 className="font-display text-xl text-primary">{b.title}</h3>
                {b.description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.description}</p> : null}
                <div className="mt-4 flex-1">
                  {b.scope ? <PortableBlocks blocks={b.scope} className="text-xs" /> : null}
                  {b.deliveryExpectations ? (
                    <div className="mt-3 flex items-start gap-2 border-l-2 border-gold/60 pl-3 text-[11px] leading-relaxed text-muted-foreground">
                      <Truck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold" />
                      {b.deliveryExpectations}
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <div>
                      <div className="eyebrow mb-0.5">Digital edition</div>
                      <div className="tabular font-display text-lg text-primary">
                        {b.pricing?.digitalKes || b.pricing?.digitalUsd
                          ? `${b.pricing.digitalKes ? `KES ${b.pricing.digitalKes.toLocaleString()}` : ''}${b.pricing.digitalKes && b.pricing.digitalUsd ? ' · ' : ''}${b.pricing.digitalUsd ? `$${b.pricing.digitalUsd.toLocaleString()}` : ''}`
                          : 'Complimentary'}
                      </div>
                    </div>
                    {b.pricing?.hardCopyAvailable && (b.pricing.hardKes || b.pricing.hardUsd) ? (
                      <div className="text-right">
                        <div className="eyebrow mb-0.5">Hard copy</div>
                        <div className="tabular font-display text-lg text-primary">
                          {b.pricing.hardKes ? `KES ${b.pricing.hardKes.toLocaleString()}` : ''}${b.pricing.hardKes && b.pricing.hardUsd ? ' · ' : ''}{b.pricing.hardUsd ? `$${b.pricing.hardUsd.toLocaleString()}` : ''}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => openOrder(b)}
                    className="inline-flex w-full items-center justify-center gap-2 border border-primary bg-primary px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep"
                  >
                    <BookOpen className="h-4 w-4" /> Order this brief
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {/* ============ CUSTOM REQUEST ============ */}
      {tab === 'custom' ? (
        <form onSubmit={submitCustomRequest} className="max-w-2xl space-y-5 rounded-card border border-border bg-card shadow-card p-6 lg:p-8">
          {customNotice ? <div className="border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">{customNotice}</div> : null}
          {customError ? <div className="border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{customError}</div> : null}
          <div>
            <h3 className="font-display text-xl text-primary">Request a custom institutional brief</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Commission underwriting on any opportunity — including off-market assets and auction inventory from auctions.murivest.com. Define the scope; your advisor confirms pricing and timeline before any work begins. No payment is taken at this step.
            </p>
          </div>
          <label className="block">
            <span className={label}>Working title</span>
            <input className={input} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} maxLength={200} placeholder="e.g. Kilimani mixed-use — full institutional underwriting" />
          </label>
          <label className="block">
            <span className={label}>Subject asset</span>
            <select className={input} value={customSource} onChange={(e) => setCustomSource(e.target.value as never)}>
              <option value="custom">A specific opportunity</option>
              <option value="off_market">An off-market asset I will describe</option>
              <option value="auction">An auction property (auctions.murivest.com)</option>
              <option value="catalog">A published opportunity</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Requested scope of work</span>
            <textarea className={`${input} min-h-32`} value={customScope} onChange={(e) => setCustomScope(e.target.value)} maxLength={4000} placeholder="Asset, address or description; the analysis you require (NOI audit, lease-by-lease, stress cases, capital structure, comparables, exit scenarios); delivery format and deadline…" />
          </label>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            {busy ? 'Submitting…' : 'Submit request for scoping'}
          </button>
        </form>
      ) : null}

      {/* ============ MY ORDERS ============ */}
      {tab === 'orders' ? (
        payNotice ? <div className="mb-5 border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">{payNotice}</div> : null
      ) : null}
      {tab === 'orders' ? (
        orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders yet"
            body="Ordered briefs — digital or hard copy, catalogue or custom — appear here with payment status, preparation progress and delivery, alongside receipts."
            action={
              <button type="button" onClick={() => setTab('catalog')} className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep">
                Browse the catalogue
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isDigital = order.format === 'digital'
              const payable = order.amountKes > 0 || order.amountUsd > 0
              const awaitingPayment = order.status === 'awaiting_payment'
              return (
                <article key={order.id} className={`border border-border bg-card ${order.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{order.reference}</span>
                        <StatusBadge status={order.status} />
                        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{isDigital ? 'Digital' : 'Hard copy'} · {humanizeStatus(order.briefType)}</span>
                      </div>
                      <h3 className="font-display text-xl text-primary">{order.briefTitle}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Ordered {fmtDate(order.createdAt)}</span>
                        {order.paymentMethod ? <span>Payment: {humanizeStatus(order.paymentMethod)}</span> : null}
                        {order.transactionId ? <span>Tx: {order.transactionId}</span> : null}
                        {order.trackingNumber ? <span className="text-primary">Tracking: {order.trackingNumber}</span> : null}
                      </div>
                      {order.customScope ? <p className="mt-3 line-clamp-2 max-w-xl border-l-2 border-gold/50 pl-3 text-xs leading-relaxed text-muted-foreground">{order.customScope}</p> : null}
                    </div>
                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <div className="text-left lg:text-right">
                        <div className="eyebrow mb-0.5">Amount</div>
                        <div className="tabular font-display text-xl text-primary">
                          {payable ? (order.amountKes > 0 ? `KES ${order.amountKes.toLocaleString()}` : `$${order.amountUsd.toLocaleString()}`) : 'Complimentary'}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {awaitingPayment ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPayModal(order)
                              setMpesaMessage('')
                              setWireRef('')
                              setPayError('')
                              setPayNotice('')
                            }}
                            className="inline-flex items-center gap-2 border border-gold bg-gold px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-forest-deep hover:bg-gold-deep hover:text-ivory"
                          >
                            <CreditCard className="h-3.5 w-3.5" /> Complete payment
                          </button>
                        ) : null}
                        {order.status === 'delivered' && isDigital ? (
                          <a href="/portal/documents" className="inline-flex items-center gap-2 border border-primary bg-primary px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-primary-foreground hover:bg-forest-deep">
                            Open in Document Room
                          </a>
                        ) : null}
                        {['pending', 'awaiting_payment', 'payment_confirmed', 'processing'].includes(order.status) ? (
                          <button type="button" onClick={() => cancelOrder(order)} className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:border-destructive hover:text-destructive">
                            <XCircle className="h-3.5 w-3.5" /> Cancel
                          </button>
                        ) : null}
                        <button type="button" onClick={() => printReceipt(order)} className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                          <Printer className="h-3.5 w-3.5" /> Receipt
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Status rail */}
                  <div className="border-t border-border bg-secondary/30 px-6 py-3">
                    <ol className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.14em]">
                      {['pending', 'awaiting_payment', 'payment_confirmed', 'processing', 'ready', 'delivered'].map((s) => {
                        const idx = ['pending', 'awaiting_payment', 'payment_confirmed', 'processing', 'ready', 'delivered'].indexOf(order.status)
                        const stepIdx = ['pending', 'awaiting_payment', 'payment_confirmed', 'processing', 'ready', 'delivered'].indexOf(s)
                        const done = order.status !== 'cancelled' && stepIdx <= idx && stepIdx !== -1
                        const skipped = !payable && s === 'awaiting_payment'
                        return (
                          <li key={s} className={cn('flex items-center gap-2', skipped && 'opacity-30')}>
                            <span className={cn('inline-flex h-4 w-4 items-center justify-center border', done ? 'border-gold bg-gold/20 text-primary' : 'border-border text-transparent')}>
                              {done ? '✓' : ''}
                            </span>
                            <span className={done ? 'text-primary' : 'text-muted-foreground'}>{humanizeStatus(s)}</span>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </article>
              )
            })}
          </div>
        )
      ) : null}

      {/* ============ ORDER FORM MODAL ============ */}
      {ordering ? (
        <div className="modal-scroll fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Place order">
          <button type="button" aria-label="Close" className="fixed inset-0 bg-forest-deep/70 backdrop-blur-sm" onClick={() => setOrdering(null)} />
          <div className="overlay-fill relative z-10 flex items-center justify-center p-4">
            <form onSubmit={placeOrder} className="max-h-viewport flex w-full max-w-lg flex-col border border-gold/25 bg-card shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6 sm:py-5">
                <div>
                  <div className="eyebrow">Order a brief</div>
                  <h3 className="font-display text-xl text-primary">{ordering.title}</h3>
                </div>
                <button type="button" onClick={() => setOrdering(null)} aria-label="Close" className="text-muted-foreground hover:text-destructive">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="modal-scroll portal-scroll flex-1 px-5 py-5 sm:px-6 sm:py-6">

            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('digital')}
                className={cn('min-w-0 border p-4 text-left transition-colors', format === 'digital' ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/50')}
              >
                <BookOpen className="mb-2 h-5 w-5 text-gold" />
                <div className="font-display text-base text-primary">Digital edition</div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {ordering.pricing?.digitalKes || ordering.pricing?.digitalUsd
                    ? `${ordering.pricing.digitalKes ? `KES ${ordering.pricing.digitalKes.toLocaleString()}` : ''}${ordering.pricing.digitalKes && ordering.pricing.digitalUsd ? ' · ' : ''}${ordering.pricing.digitalUsd ? `$${ordering.pricing.digitalUsd}` : ''}`
                    : 'Complimentary · delivered to your Document Room'}
                </div>
              </button>
              <button
                type="button"
                disabled={!ordering.pricing?.hardCopyAvailable}
                onClick={() => setFormat('hard_copy')}
                className={cn('min-w-0 border p-4 text-left transition-colors disabled:opacity-40', format === 'hard_copy' ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/50')}
              >
                <Package className="mb-2 h-5 w-5 text-gold" />
                <div className="font-display text-base text-primary">Hard copy</div>
                <div className="mt-1 break-words text-xs text-muted-foreground">
                  {ordering.pricing?.hardCopyAvailable && (ordering.pricing.hardKes || ordering.pricing.hardUsd)
                    ? `${ordering.pricing.hardKes ? `KES ${ordering.pricing.hardKes.toLocaleString()}` : ''}${ordering.pricing.hardKes && ordering.pricing.hardUsd ? ' · ' : ''}${ordering.pricing.hardUsd ? `$${ordering.pricing.hardUsd}` : ''} · courier`
                    : 'Not offered for this brief'}
                </div>
              </button>
            </div>

            {format === 'hard_copy' ? (
              <div className="mb-5 space-y-3">
                <label className="block">
                  <span className={label}>Courier delivery address</span>
                  <textarea className={`${input} min-h-20`} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} placeholder="Building, floor, street, city, country" />
                </label>
                <label className="block">
                  <span className={label}>Contact telephone</span>
                  <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} placeholder="+254 … / +44 …" />
                </label>
              </div>
            ) : null}

            {(format === 'digital' ? ordering.pricing?.digitalKes || ordering.pricing?.digitalUsd : ordering.pricing?.hardKes || ordering.pricing?.hardUsd) ? (
              <div className="mb-5">
                <span className={label}>Payment method</span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['mpesa', Smartphone, 'M-Pesa'],
                      ['wire', Building2, 'Bank wire'],
                      ['card', CreditCard, 'Card'],
                    ] as const
                  ).map(([m, Icon, lbl]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m as never)}
                      className={cn('flex items-center justify-center gap-2 border px-3 py-2.5 text-[11px] uppercase tracking-[0.1em] transition-colors', paymentMethod === m ? 'border-gold bg-gold/5 font-semibold text-primary' : 'border-border text-muted-foreground hover:border-gold/50')}
                    >
                      <Icon className="h-4 w-4 text-gold/80" /> {lbl}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'card' ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Card processing is activated by Murivest per environment. If unavailable, M-Pesa and bank wire complete instantly — the desk will confirm.
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? <div className="mb-4 border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}
              </div>

              <div className="shrink-0 border-t border-border bg-secondary/40 px-5 py-4 sm:px-6 sm:py-5">
                <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? 'Placing order…' : 'Place order'}
                </button>
                <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Every order is audit-logged · fulfilment by the Murivest research desk
                </p>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ============ PAYMENT MODAL ============ */}
      {payModal ? (
        <div className="modal-scroll fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Complete payment">
          <button type="button" aria-label="Close" className="fixed inset-0 bg-forest-deep/70 backdrop-blur-sm" onClick={() => setPayModal(null)} />
          <div className="overlay-fill relative z-10 flex items-center justify-center p-4">
            <div className="max-h-viewport flex w-full max-w-lg flex-col border border-gold/25 bg-card shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 bg-primary px-5 py-4 text-primary-foreground sm:px-6 sm:py-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ivory/60">Complete payment</div>
                <h3 className="font-display text-xl">{payModal.briefTitle}</h3>
                <div className="mt-1 text-xs text-ivory/60">
                  {payModal.reference} · {payModal.amountKes > 0 ? `KES ${payModal.amountKes.toLocaleString()}` : `$${payModal.amountUsd.toLocaleString()}`}
                </div>
              </div>
              <button type="button" onClick={() => setPayModal(null)} aria-label="Close" className="text-ivory/60 hover:text-gold">
                <X className="h-5 w-5" />
              </button>
            </div>

            {payModal.paymentMethod === 'card' ? (
              <div className="modal-scroll portal-scroll flex-1 p-5 sm:p-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Card processing is not yet enabled on this environment. Your order is reserved — complete it instantly via M-Pesa or bank wire below, or contact your advisor to arrange card settlement.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setPayModal({...payModal, paymentMethod: 'mpesa'})} className="border border-gold bg-gold/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary hover:bg-gold/20">
                    Pay via M-Pesa
                  </button>
                  <button type="button" onClick={() => setPayModal({...payModal, paymentMethod: 'wire'})} className="border border-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary hover:border-gold hover:text-gold">
                    Bank wire
                  </button>
                </div>
              </div>
            ) : payModal.paymentMethod === 'mpesa' ? (
              <form onSubmit={submitPayment} className="modal-scroll portal-scroll flex-1 space-y-5 p-5 sm:p-6">
                {MPESA.paybill ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary p-3">
                      <div className="eyebrow mb-1">Pay Bill</div>
                      <div className="font-mono text-sm text-primary">{MPESA.paybill}</div>
                    </div>
                    <div className="bg-secondary p-3">
                      <div className="eyebrow mb-1">Account</div>
                      <div className="font-mono text-sm text-primary">{MPESA.account || payModal.reference}</div>
                    </div>
                    <div className="bg-secondary p-3">
                      <div className="eyebrow mb-1">Amount</div>
                      <div className="tabular font-mono text-sm text-primary">{payModal.amountKes > 0 ? payModal.amountKes.toLocaleString() : payModal.amountUsd}</div>
                    </div>
                  </div>
                ) : (
                  <div className="border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">
                    M-Pesa collection details are configured by Murivest for this environment (NEXT_PUBLIC_MPESA_PAYBILL / NEXT_PUBLIC_MPESA_ACCOUNT). Until configured, contact your advisor for payment instructions — the order remains reserved.
                  </div>
                )}
                <label className="block">
                  <span className={label}>M-Pesa confirmation message</span>
                  <textarea className={`${input} min-h-24`} value={mpesaMessage} onChange={(e) => setMpesaMessage(e.target.value)} maxLength={1000} placeholder="Paste the full confirmation SMS you received from M-Pesa" />
                </label>
                {payError ? <div className="border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{payError}</div> : null}
                <button type="submit" disabled={payBusy} className="inline-flex w-full items-center justify-center gap-2 bg-gold px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-forest-deep transition-colors hover:bg-gold-deep hover:text-ivory disabled:opacity-60">
                  {payBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  Submit payment confirmation
                </button>
                <p className="text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Finance verifies every payment before preparation begins</p>
              </form>
            ) : (
              <form onSubmit={submitPayment} className="modal-scroll portal-scroll flex-1 space-y-5 p-5 sm:p-6">
                <div className="bg-secondary p-4 text-xs leading-relaxed text-muted-foreground">
                  <div className="eyebrow mb-2">Bank wire</div>
                  {process.env.NEXT_PUBLIC_WIRE_INSTRUCTIONS || 'Wire instructions (account, bank, reference format) are configured by Murivest per environment. Use your order reference as the payment narrative so finance can reconcile instantly.'}
                </div>
                <label className="block">
                  <span className={label}>Bank transfer reference</span>
                  <input className={input} value={wireRef} onChange={(e) => setWireRef(e.target.value)} maxLength={120} placeholder="e.g. MT103 / bank reference number" />
                </label>
                {payError ? <div className="border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{payError}</div> : null}
                <button type="submit" disabled={payBusy} className="inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
                  {payBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                  Submit wire reference
                </button>
              </form>
            )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
