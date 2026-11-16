'use client'

/**
 * Framer Motion primitives for the 2026 institutional refresh.
 * One source of motion truth: springs for directly manipulated
 * elements, the institutional curve for everything else, and
 * prefers-reduced-motion degrades everything to simple fades.
 */
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Lenis from 'lenis'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE, SPRING, SPRING_SOFT, TIMING } from '@/lib/motion'

/* ============================================================
   REVEAL & STAGGER — section entrances and KPI card decks.
   ============================================================ */

export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: TIMING.small, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/** Container for a deck of cards that settle in, one after another. */
export function StaggerGroup({
  children,
  className,
  gap = 0.06,
}: {
  children: React.ReactNode
  className?: string
  gap?: number
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  y = 16,
}: {
  children: React.ReactNode
  className?: string
  y?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : y },
        show: { opacity: 1, y: 0, transition: { duration: TIMING.small, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}

/* ============================================================
   CTA BUTTONS — pill primaries, 1.5px-border secondaries,
   ghost table actions, outline destructive. Press = spring
   scale(0.98) with settle return.
   ============================================================ */

const CTA_VARIANTS = {
  primary:
    'rounded-pill bg-primary text-primary-foreground px-6 h-11 text-sm font-medium hover:bg-primary/90 active:bg-primary/95 shadow-card',
  secondary:
    'rounded-standard border-[1.5px] border-border bg-transparent text-primary px-5 h-11 text-sm font-medium hover:border-gold hover:text-gold active:bg-gold/5',
  secondaryGold:
    'rounded-standard border-[1.5px] border-gold/50 bg-transparent text-primary px-5 h-11 text-sm font-medium hover:border-gold hover:bg-gold/5 active:bg-gold/10',
  ghost:
    'rounded-standard text-primary px-4 h-10 text-sm font-medium hover:bg-accent active:bg-accent/80',
  destructive:
    'rounded-standard border-[1.5px] border-destructive/60 bg-transparent text-destructive px-5 h-11 text-sm font-medium hover:bg-destructive/5 active:bg-destructive/10',
  destructiveSolid:
    'rounded-pill bg-destructive text-white px-6 h-11 text-sm font-medium hover:bg-destructive/90 active:bg-destructive/95',
} as const

type CtaVariant = keyof typeof CTA_VARIANTS

export function CTAButton({
  children,
  variant = 'primary',
  className,
  onClick,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode
  variant?: CtaVariant
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={SPRING}
      className={cn(
        'inline-flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50',
        CTA_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </motion.button>
  )
}

/** Same visual system for internal links (Next Link + press scale). */
export function CTALink({
  href,
  children,
  variant = 'primary',
  className,
  onClick,
  ariaLabel,
}: {
  href: string
  children: React.ReactNode
  variant?: CtaVariant
  className?: string
  onClick?: () => void
  ariaLabel?: string
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn('press-scale', CTA_VARIANTS[variant], className)}
    >
      {children}
    </Link>
  )
}

/* ============================================================
   RIGHT DRAWER — spring-driven contextual detail (holding
   drill-down, document preview). Backdrop 0.24 + soft blur.
   ============================================================ */

export function MotionDrawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  widthClass = 'max-w-md',
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  eyebrow?: string
  children: React.ReactNode
  footer?: React.ReactNode
  widthClass?: string
  className?: string
}) {
  const reduce = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title || 'Details'}>
          <motion.button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 h-full w-full cursor-default bg-black/24 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TIMING.micro }}
            onClick={onClose}
          />
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            className={cn(
              'absolute inset-y-0 right-0 flex w-full flex-col bg-card shadow-overlay outline-none',
              widthClass,
              className,
            )}
            initial={reduce ? { opacity: 0, x: 24 } : { x: '100%' }}
            animate={reduce ? { opacity: 1, x: 0 } : { x: 0 }}
            exit={reduce ? { opacity: 0, x: 24 } : { x: '100%' }}
            transition={reduce ? { duration: TIMING.micro, ease: EASE } : SPRING_SOFT}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div className="min-w-0">
                {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
                {title ? <h2 className="font-display text-xl leading-tight text-primary">{title}</h2> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="rounded-standard inline-flex h-9 w-9 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="modal-scroll flex-1 px-6 py-6">{children}</div>
            {footer ? <div className="border-t border-border px-6 py-4">{footer}</div> : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

/* ============================================================
   CENTERED MODAL — short forms and destructive confirmations
   only. Medium timing, scale 0.98 → 1.
   ============================================================ */

export function MotionModal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = 'max-w-md',
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  widthClass?: string
  className?: string
}) {
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/24 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TIMING.micro }}
          />
          <motion.div
            className={cn(
              'relative z-10 flex w-full flex-col rounded-card bg-card shadow-overlay outline-none',
              'max-h-viewport',
              widthClass,
              className,
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: TIMING.medium, ease: EASE }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              {title ? <h2 className="font-display text-xl leading-tight text-primary">{title}</h2> : <span />}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-standard inline-flex h-9 w-9 flex-shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="modal-scroll px-6 py-6">{children}</div>
            {footer ? <div className="border-t border-border px-6 py-4">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

/* ============================================================
   SMOOTH SCROLL — Lenis inertial momentum, except on the
   dashboard and holdings pages where the spec keeps native,
   uninterrupted scroll. Reduced motion always stays native.
   ============================================================ */

export function SmoothScroll({ native }: { native?: boolean }) {
  const pathname = usePathname()
  const reduce = useReducedMotion()

  useEffect(() => {
    if (native || reduce) return
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    })
    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [pathname, native, reduce])

  return null
}

/** True when a route must keep native, uninterrupted scrolling. */
export function isNativeScrollRoute(pathname: string): boolean {
  return pathname === '/portal' || pathname.startsWith('/portal/portfolio')
}
