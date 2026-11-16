import {cn} from '@/lib/utils'
import {humanizeStatus, statusTone} from '@/lib/format'
import type {LucideIcon} from 'lucide-react'

const TONE_CLASSES: Record<string, string> = {
  neutral: 'bg-secondary text-secondary-foreground border-border',
  progress: 'bg-amber-50 text-amber-800 border-amber-200',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-orange-50 text-orange-800 border-orange-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
}

export function StatusBadge({status, className}: {status: string; className?: string}) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        'rounded-micro inline-flex items-center border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {humanizeStatus(status)}
    </span>
  )
}

export function TierBadge({tier, className}: {tier: 'tier_1' | 'tier_2' | 'tier_3'; className?: string}) {
  const labels = {
    tier_1: 'Tier 1 · Verified',
    tier_2: 'Tier 2 · Confidential',
    tier_3: 'Tier 3 · Institutional',
  } as const
  return (
    <span className={cn('rounded-micro inline-flex items-center border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary', className)}>
      {labels[tier]}
    </span>
  )
}

export function InlineTag({children, className}: {children: React.ReactNode; className?: string}) {
  return (
    <span className={cn('rounded-micro inline-flex items-center bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-secondary-foreground', className)}>
      {children}
    </span>
  )
}

/** Metric tile — the dense financial readout used across the workspace.
 *  16px card geometry, one soft shadow, caption → value → supporting
 *  metadata rhythm, and the quiet -2px hover lift. */
export function Metric({
  label,
  value,
  sub,
  tone = 'default',
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'default' | 'gold' | 'deep'
  className?: string
}) {
  return (
    <div
      className={cn(
        'card-lift rounded-card border p-4 shadow-card',
        tone === 'deep'
          ? 'border-transparent bg-primary text-primary-foreground'
          : tone === 'gold'
            ? 'border-gold/30 bg-gold/5'
            : 'border-border bg-card',
        className,
      )}
    >
      <div className={cn('eyebrow mb-1.5', tone === 'deep' && 'text-primary-foreground/60')}>{label}</div>
      <div className={cn('tabular font-display text-2xl leading-none', tone === 'deep' ? 'text-gold' : 'text-foreground')}>{value}</div>
      {sub ? <div className={cn('mt-1.5 text-xs text-muted-foreground', tone === 'deep' && 'text-primary-foreground/70')}>{sub}</div> : null}
    </div>
  )
}

/** Purposeful empty state — guides the investor to the next step. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  body: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-card card-lift border border-dashed border-gold/40 bg-secondary/40 px-6 py-12 text-center shadow-none', className)}>
      {Icon ? <Icon className="mx-auto mb-4 h-10 w-10 text-gold/60" strokeWidth={1.25} /> : null}
      <h3 className="font-display text-xl text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('mb-6', className)}>
      {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
      <h2 className="font-display text-2xl text-primary md:text-3xl">{title}</h2>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  )
}
