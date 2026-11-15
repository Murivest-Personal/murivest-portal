import type {ReactNode} from 'react'
import {cn} from '@/lib/utils'
import {humanizeStatus, statusTone, fmtNumber, compactMoney} from '@/lib/format'

/**
 * Admin UI primitives — the shared visual language of the internal system.
 * Institutional, high-trust, consistent with the investor portal (deep
 * forest green, restrained gold, warm off-white, sharp editorial corners).
 * Pure presentational components (server-safe).
 */

export function PageHeader({eyebrow, title, description, actions}: {eyebrow?: string; title: string; description?: string; actions?: ReactNode}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="font-display text-2xl text-primary sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

const TONE_CLASSES: Record<string, string> = {
  neutral: 'border-border bg-secondary text-secondary-foreground',
  progress: 'border-gold/40 bg-gold/10 text-primary',
  success: 'border-forest/30 bg-forest/10 text-forest',
  warning: 'border-gold/50 bg-gold/15 text-gold-deep',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  info: 'border-forest/20 bg-forest/5 text-primary',
}

export function StatusPill({status, label}: {status: string; label?: string}) {
  const tone = statusTone(status)
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]', TONE_CLASSES[tone])}>
      {label ?? humanizeStatus(status)}
    </span>
  )
}

export function RolePill({role}: {role: string}) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]', TONE_CLASSES.info)}>
      {humanizeStatus(role)}
    </span>
  )
}

export function TrendPill({value, invert = false}: {value: number | null; invert?: boolean}) {
  if (value == null) return <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">no prior period</span>
  const positive = invert ? value < 0 : value > 0
  const flat = Math.abs(value) < 0.05
  return (
    <span className={cn('text-xs font-medium', flat ? 'text-muted-foreground' : positive ? 'text-forest' : 'text-destructive')}>
      {value > 0 ? '▲' : value < 0 ? '▼' : '—'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function MetricTile({
  label,
  value,
  sub,
  icon,
  trend,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  trend?: number | null
  tone?: keyof typeof TONE_CLASSES
}) {
  return (
    <div className={cn('border p-4 sm:p-5', TONE_CLASSES[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-70">{label}</div>
        {icon ? <div className="text-gold">{icon}</div> : null}
      </div>
      <div className="mt-2 font-display text-2xl text-primary">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      {trend !== undefined ? <div className="mt-2"><TrendPill value={trend} /></div> : null}
    </div>
  )
}

export function SectionCard({title, description, actions, children, className}: {title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string}) {
  return (
    <section className={cn('border border-border bg-card', className)}>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="font-display text-base text-primary">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export function EmptyState({title, description, action}: {title: string; description?: string; action?: ReactNode}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-border bg-secondary/40 px-6 py-10 text-center">
      <div className="gold-rule w-10" aria-hidden="true" />
      <div className="mt-3 font-display text-sm text-primary">{title}</div>
      {description ? <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function KeyValue({items}: {items: {label: string; value: ReactNode}[]}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 border-b border-border/60 pb-2">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 truncate text-sm text-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Dense money/number cell formatting for tables. */
export function MoneyCell({value, currency = 'USD', compact = true}: {value: number | null | undefined; currency?: string; compact?: boolean}) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  return <span className="tabular-nums">{compact ? compactMoney(value, currency) : fmtNumber(value)}</span>
}

export function DataTable({head, children, dense = false}: {head: ReactNode[]; children: ReactNode; dense?: boolean}) {
  return (
    <div className="portal-scroll -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th key={i} className={cn('whitespace-nowrap px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground', i === 0 ? 'pl-0' : '')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn('divide-y divide-border/60', dense ? '[&_td]:py-2' : '[&_td]:py-3')}>{children}</tbody>
      </table>
    </div>
  )
}
