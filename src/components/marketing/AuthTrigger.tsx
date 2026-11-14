'use client'

import {useAuthModal} from './AuthModalProvider'
import {cn} from '@/lib/utils'
import type {Mode} from './AuthModal'

type Variant = 'gold' | 'outline' | 'deep' | 'ghost-ivory'

const VARIANTS: Record<Variant, string> = {
  gold: 'bg-gold text-forest-deep hover:bg-gold-deep hover:text-ivory',
  outline: 'border border-ivory/40 text-ivory hover:border-gold hover:text-gold',
  deep: 'bg-primary text-primary-foreground hover:bg-forest-deep',
  'ghost-ivory': 'text-ivory/80 hover:text-gold',
}

/** CTA button that opens the authentication modal. */
export function AuthTrigger({
  children,
  mode = 'signin',
  variant = 'gold',
  className,
}: {
  children: React.ReactNode
  mode?: Mode
  variant?: Variant
  className?: string
}) {
  const {open} = useAuthModal()
  return (
    <button
      type="button"
      onClick={() => open(mode)}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}
