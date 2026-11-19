'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion'
import {
  LayoutDashboard,
  Search,
  Calculator,
  Columns3,
  ClipboardList,
  Briefcase,
  ScrollText,
  FolderLock,
  Newspaper,
  BookOpen,
  MessagesSquare,
  UserRound,
  ShieldCheck,
  LogOut,
  Bell,
  MoreHorizontal,
  X,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import type {LucideIcon} from 'lucide-react'
import NotificationBell from './NotificationBell'
import NotificationToaster from './NotificationToaster'
import InstallAppButton from '@/components/shared/InstallAppButton'
import {SmoothScroll, isNativeScrollRoute} from '@/components/brand/motion'
import {EASE, SPRING, TIMING} from '@/lib/motion'
import {ensureServiceWorker} from '@/lib/client/push'

/** The twelve primary modules, in the specification's order. */
const NAV: {href: string; label: string; icon: LucideIcon; exact?: boolean}[] = [
  {href: '/portal', label: 'Overview', icon: LayoutDashboard, exact: true},
  {href: '/portal/discover', label: 'Discover', icon: Search},
  {href: '/portal/studio', label: 'Investment Studio', icon: Calculator},
  {href: '/portal/compare', label: 'Compare', icon: Columns3},
  {href: '/portal/orders', label: 'Orders', icon: ClipboardList},
  {href: '/portal/portfolio', label: 'My Investments', icon: Briefcase},
  {href: '/portal/mandates', label: 'Mandates', icon: ScrollText},
  {href: '/portal/documents', label: 'Documents', icon: FolderLock},
  {href: '/portal/property-briefs', label: 'Property briefs', icon: BookOpen},
  {href: '/portal/intelligence', label: 'Market Intelligence', icon: Newspaper},
  {href: '/portal/activity', label: 'Activity & Comms', icon: MessagesSquare},
  {href: '/portal/profile', label: 'Profile & Preferences', icon: UserRound},
  {href: '/portal/security', label: 'Account & Security', icon: ShieldCheck},
]

/** Mobile bottom bar: the four highest-frequency destinations + More. */
const NAV_MOBILE: {href: string; label: string; icon: LucideIcon; exact?: boolean}[] = [
  {href: '/portal', label: 'Overview', icon: LayoutDashboard, exact: true},
  {href: '/portal/discover', label: 'Discover', icon: Search},
  {href: '/portal/portfolio', label: 'Holdings', icon: Briefcase},
  {href: '/portal/documents', label: 'Docs', icon: FolderLock},
]

export interface PortalShellProps {
  /** Authed user id — scopes the Realtime websocket channel + notifications feed. */
  userId: string
  firstName: string
  classification: string
  tier: string
  tierLabel: string
  email: string
  children: React.ReactNode
}

export default function PortalShell({userId, firstName, classification, tierLabel, email, children}: PortalShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Register the Service Worker once per portal session — enables Web Push
  // (desktop + installed PWA) and the offline notification cache. Degrades
  // silently where unsupported.
  useEffect(() => {
    void ensureServiceWorker()
  }, [])

  // Lock body scroll behind the momentum sheet.
  useEffect(() => {
    if (!sheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [sheetOpen])

  const closeSheet = () => setSheetOpen(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  async function signOut() {
    await fetch('/api/auth/logout', {method: 'POST'}).catch(() => {})
    router.push('/')
    router.refresh()
  }

  const railFooter = (
    <div className="border-t border-ivory/10 px-5 py-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-gold/80">{tierLabel}</div>
      <div className="mt-1 text-xs text-ivory/60">{classification}</div>
      <div className="mt-3 truncate text-[10px] text-ivory/35">{email}</div>
      <button
        type="button"
        onClick={signOut}
        className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ivory/50 transition-colors hover:text-gold"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </div>
  )

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-6 pt-7">
        <Link href="/portal" aria-label="Murivest portal overview">
          <span className="font-display text-xl font-semibold tracking-[0.08em] text-ivory">MURIVEST</span>
        </Link>
        <div className="gold-rule mt-2 w-10" />
        <div className="mt-4 text-[9px] uppercase tracking-[0.2em] text-ivory/40">Private capital workspace</div>
      </div>

      <nav className="portal-scroll flex-1 overflow-y-auto px-3 pb-6" aria-label="Portal">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-active={active}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-pill px-3.5 py-2.5 text-[13px] transition-colors duration-200',
                    active ? 'font-medium text-ivory' : 'text-ivory/60 hover:bg-ivory/5 hover:text-ivory',
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="rail-active-pill"
                      className="absolute inset-0 rounded-pill border border-gold/25 bg-gold/15"
                      transition={SPRING}
                    />
                  ) : null}
                  <item.icon
                    className={cn('relative h-4 w-4 flex-shrink-0', active ? 'text-gold' : 'text-ivory/50 group-hover:text-gold/80')}
                    strokeWidth={1.75}
                  />
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {railFooter}
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Inertial scroll everywhere except the dashboard and holdings
          pages, which the spec keeps native and uninterrupted. */}
      <SmoothScroll native={isNativeScrollRoute(pathname)} />

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 bg-sidebar lg:block">{sidebar}</aside>

      {/* Mobile momentum sheet — full navigation on demand */}
      <MobileNavSheet open={sheetOpen} onClose={closeSheet} activeFn={isActive} onSignOut={signOut} tierLabel={tierLabel} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/portal" aria-label="Murivest portal overview" className="lg:hidden">
                <span className="font-display text-sm font-semibold tracking-[0.08em] text-primary">MURIVEST</span>
              </Link>
              <div className="hidden min-w-0 items-baseline gap-3 lg:flex">
                <span className="truncate font-display text-lg text-primary">Welcome, {firstName}</span>
                <span className="gold-rule hidden w-10 xl:block" aria-hidden="true" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <InstallAppButton />
              <NotificationBell />
              <Link
                href="/portal/security"
                className="rounded-standard press-scale inline-flex h-9 w-9 items-center justify-center border border-border text-primary transition-colors hover:border-gold hover:text-gold"
                aria-label="Account & security"
              >
                <ShieldCheck className="h-4 w-4" />
              </Link>
              <span className="rounded-micro hidden items-center gap-2 border border-gold/30 bg-gold/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary sm:inline-flex">
                <Bell className="h-3 w-3 text-gold" />
                {tierLabel}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 lg:px-8 lg:py-12">{children}</main>

        <NotificationToaster userId={userId} />

        <footer className="mt-auto border-t border-border pb-16 lg:pb-0">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <span>© {new Date().getFullYear()} Murivest Group Ltd · Strictly confidential</span>
            <a href="mailto:office@murivest.com" className="hover:text-gold">
              office@murivest.com
            </a>
          </div>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav onMore={() => setSheetOpen(true)} activeFn={isActive} />
    </div>
  )
}

/* ============================================================
   MOBILE NAV — bottom bar (4 destinations + More) with soft
   active pills; "More" opens the spring momentum sheet holding
   all twelve modules. Momentum sheet keeps every destination
   one gesture away without hiding anything on desktop.
   ============================================================ */

function MobileBottomNav({
  onMore,
  activeFn,
}: {
  onMore: () => void
  activeFn: (href: string, exact?: boolean) => boolean
}) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      style={{paddingBottom: 'env(safe-area-inset-bottom)'}}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {NAV_MOBILE.map((item) => {
          const active = activeFn(item.href, item.exact)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-1"
            >
              <span
                className={cn(
                  'flex h-7 items-center rounded-pill px-5 transition-colors duration-200',
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.75} />
              </span>
              <span className={cn('text-[9px] font-medium uppercase tracking-[0.1em]', active ? 'text-primary' : 'text-muted-foreground')}>
                {item.label}
              </span>
            </Link>
          )
        })}
        <button type="button" onClick={onMore} className="flex flex-col items-center justify-center gap-1" aria-label="More navigation">
          <span className="flex h-7 items-center rounded-pill px-5 text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">More</span>
        </button>
      </div>
    </nav>
  )
}

function MobileNavSheet({
  open,
  onClose,
  activeFn,
  onSignOut,
  tierLabel,
}: {
  open: boolean
  onClose: () => void
  activeFn: (href: string, exact?: boolean) => boolean
  onSignOut: () => void
  tierLabel: string
}) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <motion.button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 h-full w-full cursor-default bg-black/24 backdrop-blur-[2px]"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: TIMING.micro}}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-md flex-col rounded-t-card bg-card shadow-overlay"
            style={{maxHeight: 'calc(100dvh - 3rem)', paddingBottom: 'env(safe-area-inset-bottom)'}}
            initial={reduce ? {opacity: 0, y: 24} : {y: '100%'}}
            animate={reduce ? {opacity: 1, y: 0} : {y: 0}}
            exit={reduce ? {opacity: 0, y: 24} : {y: '100%'}}
            transition={reduce ? {duration: TIMING.micro, ease: EASE} : SPRING}
          >
            <div className="flex items-center justify-between px-6 pt-5">
              <div>
                <div className="eyebrow mb-1">{tierLabel}</div>
                <h2 className="font-display text-lg text-primary">All sections</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="rounded-standard inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="modal-scroll px-4 py-4">
              <motion.ul
                className="grid grid-cols-2 gap-2"
                initial="hidden"
                animate="show"
                variants={{hidden: {}, show: {transition: {staggerChildren: 0.03}}}}
              >
                {NAV.map((item) => {
                  const active = activeFn(item.href, item.exact)
                  const Icon = item.icon
                  return (
                    <motion.li
                      key={item.href}
                      variants={{
                        hidden: {opacity: 0, y: reduce ? 0 : 10},
                        show: {opacity: 1, y: 0, transition: {duration: TIMING.micro, ease: EASE}},
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex h-full items-center gap-3 rounded-card border px-4 py-3 text-[13px] transition-colors duration-200',
                          active
                            ? 'border-gold/30 bg-gold/10 font-medium text-primary'
                            : 'border-border bg-card text-foreground hover:border-gold/40 hover:bg-gold/5',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-gold' : 'text-muted-foreground')} strokeWidth={1.75} />
                        {item.label}
                      </Link>
                    </motion.li>
                  )
                })}
              </motion.ul>
              <button
                type="button"
                onClick={onSignOut}
                className="mt-3 flex w-full items-center gap-3 rounded-card border border-border px-4 py-3 text-[13px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
