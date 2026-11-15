'use client'

import {useState} from 'react'
import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
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
  LogOut,
  Menu,
  X,
  Lock,
} from 'lucide-react'
import {cn} from '@/lib/utils'

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
  compliance: ShieldCheck,
  intelligence: Newspaper,
  analytics: BarChart3,
  finance: Landmark,
  settings: Settings2,
}

export interface AdminShellProps {
  staffName: string
  roleLabel: string
  email: string
  nav: AdminNavItem[]
  children: React.ReactNode
}

/** The internal operations rail — same visual language as the investor portal,
 *  unmistakably internal. Desktop-primary with solid tablet/mobile support. */
export default function AdminShell({staffName, roleLabel, email, nav, children}: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

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
        <Link href="/admin" aria-label="Murivest admin command centre">
          <span className="font-display text-xl font-semibold tracking-[0.08em] text-ivory">MURIVEST</span>
        </Link>
        <div className="gold-rule mt-2 w-10" />
        <div className="mt-4 inline-flex items-center gap-2 border border-gold/30 bg-gold/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-gold">
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
                  onClick={closeMenu}
                  data-active={active}
                  className={cn(
                    'group flex items-center gap-3 border-l-2 px-3 py-2.5 text-[13px] transition-colors',
                    active
                      ? 'border-gold bg-ivory/10 font-medium text-ivory'
                      : 'border-transparent text-ivory/60 hover:border-gold/50 hover:text-ivory',
                  )}
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-gold' : 'text-ivory/50 group-hover:text-gold/80')} strokeWidth={1.75} />
                  {item.label}
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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 bg-sidebar lg:block">{sidebar}</aside>

      {/* Tablet / mobile drawer */}
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
                <span className="truncate font-display text-lg text-primary">Command Centre</span>
                <span className="gold-rule hidden w-10 xl:block" aria-hidden="true" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 border border-gold/30 bg-gold/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary sm:inline-flex">
                <ShieldCheck className="h-3 w-3 text-gold" />
                {roleLabel}
              </span>
              <span className="hidden text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:inline">Murivest staff</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-8 lg:px-8 lg:py-10">{children}</main>

        <footer className="mt-auto border-t border-border">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-5 py-6 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <span>© {new Date().getFullYear()} Murivest Group Ltd · Internal — strictly confidential</span>
            <span>Every action is audit-logged</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
