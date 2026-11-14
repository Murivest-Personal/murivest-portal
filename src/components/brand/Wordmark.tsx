import {cn} from '@/lib/utils'

/** Murivest wordmark — editorial serif with the gold rule accent. */
export function Wordmark({
  size = 'md',
  tone = 'forest',
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'forest' | 'ivory'
  className?: string
}) {
  const sizes = {
    sm: {text: 'text-lg', rule: 'w-8', gap: 'gap-2'},
    md: {text: 'text-2xl', rule: 'w-12', gap: 'gap-3'},
    lg: {text: 'text-4xl', rule: 'w-20', gap: 'gap-4'},
  }[size]
  return (
    <span className={cn('inline-flex items-baseline', sizes.gap, className)}>
      <span
        className={cn(
          'font-display font-semibold tracking-[0.08em]',
          sizes.text,
          tone === 'forest' ? 'text-primary' : 'text-ivory',
        )}
      >
        MURIVEST
      </span>
      <span className={cn('gold-rule', sizes.rule)} aria-hidden="true" />
    </span>
  )
}

/** Small gold monogram tile used as an icon mark. */
export function Monogram({className}: {className?: string}) {
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center bg-primary font-display text-lg font-semibold text-gold',
        className,
      )}
      aria-hidden="true"
    >
      M
    </span>
  )
}
