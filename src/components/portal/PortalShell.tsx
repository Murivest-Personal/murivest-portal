'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
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
  MessagesSquare,
  UserRound,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Bell,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import type {LucideIcon} from 'lucide-react'
import NotificationBell from './NotificationBell'
import NotificationToaster from './NotificationToaster'
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
  {href: '/portal/intelligence', label: 'Market Intelligence', icon: Newspaper},
  {href: '/portal/activity', label: 'Activity & Comms', icon: MessagesSquare},
  {href: '/portal/profile', label: 'Profile & Preferences', icon: UserRound},
  {href: '/portal/security', label: 'Account & Security', icon: ShieldCheck},
]

export interface PortalShellProps {
  firstName: string
  classification: string
  tier: string
  tierLabel: string
  email: string
  children: React.ReactNode
}

export default function PortalShell({firstName, classification, tierLabel, email, children}: PortalShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  // Register the Service Worker once per portal session — enables Web Push
  // (desktop + installed PWA) and the offline notification cache. Degrades
  // silently where unsupported.
  useEffect(() => {
    void ensureServiceWorker()
  }, [])

  const closeMenu = () => setMenuOpen(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  async function signOut() {
    await fetch('/api/auth/logout', {method: 'POST'}).catch(() => {})
    router.push('/')
    router.refresh()
  }

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
                  onClick={closeMenu}
                  data-active={active}
                  className={cn(
                    'group flex items-center gap-3 border-l-2 px-3 py-2.5 text-[13px] transition-colors',
                    active
                      ? 'border-gold bg-ivory/10 font-medium text-ivory'
                      : 'border-transparent text-ivory/60 hover:border-gold/50 hover:text-ivory',
                  )}
                >
                  <item.icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-gold' : 'text-ivory/50 group-hover:text-gold/80')} strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

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
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 bg-sidebar lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-forest-deep/70 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar shadow-2xl">
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="absolute right-4 top-4 text-ivory/60 hover:text-gold">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation"
                className="inline-flex h-9 w-9 items-center justify-center border border-border text-primary lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="hidden min-w-0 items-baseline gap-3 lg:flex">
                <span className="truncate font-display text-lg text-primary">Welcome, {firstName}</span>
                <span className="gold-rule hidden w-10 xl:block" aria-hidden="true" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Link
                href="/portal/security"
                className="inline-flex h-9 w-9 items-center justify-center border border-border text-primary transition-colors hover:border-gold hover:text-gold"
                aria-label="Account & security"
              >
                <ShieldCheck className="h-4 w-4" />
              </Link>
              <span className="hidden items-center gap-2 border border-gold/30 bg-gold/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary sm:inline-flex">
                <Bell className="h-3 w-3 text-gold" />
                {tierLabel}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 lg:px-8 lg:py-12">{children}</main>

        <NotificationToaster />

        <footer className="mt-auto border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <span>© {new Date().getFullYear()} Murivest Group Ltd · Strictly confidential</span>
            <a href="mailto:office@murivest.com" className="hover:text-gold">
              office@murivest.com
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
