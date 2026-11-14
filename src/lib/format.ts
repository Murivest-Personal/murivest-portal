/** Institutional formatting helpers — consistent across the workspace. */

export function fmtMoney(value: number | null | undefined, currency = 'USD', opts?: {compact?: boolean}): string {
  if (value == null || Number.isNaN(value)) return '—'
  const zero = new Set(['USD', 'EUR', 'GBP']).has(currency) ? 0 : 0
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: opts?.compact ? 1 : zero,
      notation: opts?.compact ? 'compact' : 'standard',
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString('en-GB')}`
  }
}

export function fmtNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-GB', {maximumFractionDigits: digits, minimumFractionDigits: digits}).format(value)
}

export function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${fmtNumber(value, digits)}%`
}

export function fmtRatio(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${fmtNumber(value, digits)}×`
}

export function fmtYears(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${fmtNumber(value, 1)} yrs`
}

export function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})
}

export function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})
}

export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(d)
}

/** 4.2 → "$4.2M" style used in dense metric tiles. */
export function compactMoney(value: number | null | undefined, currency = 'USD'): string {
  return fmtMoney(value, currency, {compact: true})
}

export function statusTone(status: string): 'neutral' | 'progress' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'delivered':
    case 'verified':
    case 'approved':
    case 'ready':
    case 'done':
    case 'active':
    case 'held':
    case 'clear':
    case 'paid':
      return 'success'
    case 'awaiting_payment':
    case 'pending':
    case 'submitted':
    case 'scheduled':
    case 'in_review':
    case 'kyc_pending':
    case 'payment_confirmed':
      return 'progress'
    case 'processing':
    case 'called':
    case 'profile_submitted':
    case 'email_verified':
      return 'info'
    case 'under_offer':
    case 'marketed':
    case 'draft':
    case 'paused':
    case 'committed':
      return 'neutral'
    case 'rejected':
    case 'declined':
    case 'failed':
    case 'cancelled':
    case 'defaulted':
    case 'flagged':
    case 'locked':
    case 'suspended':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function humanizeStatus(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
