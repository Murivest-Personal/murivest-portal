'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion'
import {
  LayoutDashboard,
  UsersRound,
  Building2,
  Map,
  ClipboardList,
  ScrollText,
  FolderLock,
  MessagesSquare,
  ShieldCheck,
  Newspaper,
  BarChart3,
  Landmark,
  Settings2,
  Megaphone,
  LogOut,
  Lock,
  MoreHorizontal,
  X,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import NotificationBell from '@/components/portal/NotificationBell'
import NotificationToaster from '@/components/portal/NotificationToaster'
import InstallAppButton from '@/components/shared/InstallAppButton'
import {SmoothScroll} from '@/components/brand/motion'
import {EASE, SPRING, TIMING} from '@/lib/motion'
import {ensureServiceWorker} from '@/lib/client/push'

export interface AdminNavItem {
  href: string
  label: string
  icon: string // icon key resolved below
}

const ICONS: Record<string, React.ComponentType<{className?: string; strokeWidth?: number}>> = {
  command: LayoutDashboard,
  investors: UsersRound,
  organisations: Building2,
  opportunities: Map,
  orders: ClipboardList,
  mandates: ScrollText,
  documents: FolderLock,
  communications: MessagesSquare,
  notifications: Megaphone,
  compliance: ShieldCheck,
  intelligence: Newspaper,
  analytics: BarChart3,
  finance: Landmark,
  settings: Settings2,
}

/** Mobile bottom bar destinations, resolved from the nav prop. */
const MOBILE_KEYS = new Set(['command', 'investors', 'orders'])

export interface AdminShellProps {
  /** Authed staff/admin user id — scopes the Realtime websocket channel. */
  userId: string
  staffName: string
  roleLabel: string
  email: string
  nav: AdminNavItem[]
  children: React.ReactNode
}

/** The internal operations rail — same visual language as the investor portal,
 *  unmistakably internal. Desktop-primary with solid tablet/mobile support.
 *
 *  Staff and admins receive the same active-notification pipeline as
 *  investors: Supabase Realtime websocket toasts, the shared Notification
 *  Centre bell, Web Push to phone/desktop installs of this shell, and the
 *  PWA install affordance. */
export default function AdminShell({userId, staffName, roleLabel, email, nav, children}: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Register the Service Worker once per admin session — enables Web Push
  // (desktop + installed PWA) and the offline notification cache.
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

  const mobileNav = nav.filter((item) => MOBILE_KEYS.has(item.icon))

  async function signOut() {
    await fetch('/api/auth/logout', {method: 'POST'}).catch(() => {})
    router.push('/')
    router.refresh()
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-6 pt-7">
        <Link href="/admin" aria-label="Murivest admin command centre">
          <span className="font-display text-xl font-semibold tracking-[0.08em] text-ivory">MURIVEST</span>
        </Link>
        <div className="gold-rule mt-2 w-10" />
        <div className="rounded-micro mt-4 inline-flex items-center gap-2 border border-gold/30 bg-gold/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-gold">
          <Lock className="h-3 w-3" strokeWidth={2} /> Internal system
        </div>
        <div className="mt-3 text-[9px] uppercase tracking-[0.2em] text-ivory/40">Capital operations</div>
      </div>

      <nav className="portal-scroll flex-1 overflow-y-auto px-3 pb-6" aria-label="Admin modules">
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard
            const active = isActive(item.href, item.href === '/admin')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeSheet}
                  data-active={active}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-pill px-3.5 py-2.5 text-[13px] transition-colors duration-200',
                    active ? 'font-medium text-ivory' : 'text-ivory/60 hover:bg-ivory/5 hover:text-ivory',
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="admin-rail-active-pill"
                      className="absolute inset-0 rounded-pill border border-gold/25 bg-gold/15"
                      transition={SPRING}
                    />
                  ) : null}
                  <Icon
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

      <div className="border-t border-ivory/10 px-5 py-5">
        <div className="text-[10px] uppercase tracking-[0.16em] text-gold/80">{roleLabel}</div>
        <div className="mt-1 truncate text-xs text-ivory/60">{staffName}</div>
        <div className="mt-1 truncate text-[10px] text-ivory/35">{email}</div>
        <button
          type="button"
          onClick={signOut}
          className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ivory/50 transition-colors hover:text-gold"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  )

  const reduce = useReducedMotion()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Inertial scroll on internal surfaces — all operational pages keep
          native uninterrupted wheel scroll on data-heavy tables. */}
      <SmoothScroll />

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 bg-sidebar lg:block">{sidebar}</aside>

      {/* Tablet / mobile momentum sheet */}
      <AnimatePresence>
        {sheetOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All modules">
            <motion.button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 h-full w-full cursor-default bg-black/24 backdrop-blur-[2px]"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: TIMING.micro}}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar shadow-overlay"
              initial={reduce ? {opacity: 0, x: -24} : {x: '-100%'}}
              animate={reduce ? {opacity: 1, x: 0} : {x: 0}}
              exit={reduce ? {opacity: 0, x: -24} : {x: '-100%'}}
              transition={reduce ? {duration: TIMING.micro, ease: EASE} : SPRING}
            >
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close navigation"
                className="absolute right-4 top-4 z-10 text-ivory/60 transition-colors hover:text-gold"
              >
                <X className="h-5 w-5" />
              </button>
              {sidebar}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/admin" aria-label="Command centre" className="lg:hidden">
                <span className="font-display text-sm font-semibold tracking-[0.08em] text-primary">MURIVEST</span>
              </Link>
              <div className="hidden min-w-0 items-baseline gap-3 lg:flex">
                <span className="truncate font-display text-lg text-primary">Command Centre</span>
                <span className="gold-rule hidden w-10 xl:block" aria-hidden="true" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <InstallAppButton />
              <NotificationBell settingsHref="/admin/notifications" activityHref="/admin" />
              <span className="rounded-micro hidden items-center gap-2 border border-gold/30 bg-gold/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary sm:inline-flex">
                <ShieldCheck className="h-3 w-3 text-gold" />
                {roleLabel}
              </span>
              <span className="hidden text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:inline">Murivest staff</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-8 lg:px-8 lg:py-10">{children}</main>

        <NotificationToaster userId={userId} />

        <footer className="mt-auto border-t border-border pb-16 lg:pb-0">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-6 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <span>© {new Date().getFullYear()} Murivest Group Ltd · Internal — strictly confidential</span>
            <span>Every action is audit-logged</span>
          </div>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
        style={{paddingBottom: 'env(safe-area-inset-bottom)'}}
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {mobileNav.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard
            const active = isActive(item.href, item.href === '/admin')
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className="flex flex-col items-center justify-center gap-1">
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
          <button type="button" onClick={() => setSheetOpen(true)} className="flex flex-col items-center justify-center gap-1" aria-label="More navigation">
            <span className="flex h-7 items-center rounded-pill px-5 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">More</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
