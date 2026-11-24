
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowUpRight,
  ArrowRight,
  LockKeyhole,
  Menu,
} from 'lucide-react'

import { useAuthModal } from './AuthModalProvider'
import { cn } from '@/lib/utils'

/* ============================================================
   MURIVEST GROUP LTD
   Institutional Landing Header
   Design: Quiet Luxury / Institutional / Editorial
============================================================ */

const NAV_ITEMS = [
  { label: 'Underwriting', href: '/differential-underwriting' },
  { label: 'Calculator', href: '/underwriting-calculator' },
  { label: 'Insights', href: '/insights' },
  { label: 'Private Office', href: '/billionaire-real-estate' },
  { label: 'Contact', href: '/#contact' },
]

const MOBILE_ITEMS = [
  ...NAV_ITEMS,
  { label: 'The Letter', href: '/#letter' },
  { label: 'Private Access', href: '/#access' },
]

function isActive(pathname: string, href: string) {
  if (href.startsWith('/#')) return false

  return pathname === href || pathname.startsWith(`${href}/`)
}

/* ============================================================
   HEADER
============================================================ */

export default function LandingHeader({
  isAuthenticated,
}: {
  isAuthenticated: boolean
}) {
  const { open } = useAuthModal()
  const pathname = usePathname() ?? '/'

  return (
    <header className="sticky top-0 z-50 w-full">

      {/* MAIN NAVIGATION */}
      <div className="border-b border-white/10 bg-forest-deep/95 backdrop-blur-xl">

        <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">

          <div className="flex h-[76px] items-center justify-between gap-6">

            {/* BRAND IDENTITY */}
            <Link
              href="/"
              aria-label="Murivest Group home"
              className="group flex shrink-0 items-center gap-3"
            >
              <div className="flex flex-col justify-center">

                <span className="font-display text-[21px] font-semibold leading-none tracking-[0.12em] text-ivory transition-colors group-hover:text-gold">
                  MURIVEST
                </span>

                <span className="mt-2 text-[7px] font-medium uppercase tracking-[0.35em] text-gold/80">
                  The Concierge of Capital
                </span>

              </div>
            </Link>

            {/* DESKTOP NAVIGATION */}
            <nav
              className="hidden items-center gap-7 xl:flex"
              aria-label="Primary navigation"
            >
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href)

                const linkClass = cn(
                  'relative py-2 text-[10px] font-medium uppercase tracking-[0.16em]',
                  'transition-colors duration-300',
                  active
                    ? 'text-gold'
                    : 'text-ivory/65 hover:text-ivory',
                )

                const indicator = (
                  <span
                    className={cn(
                      'absolute -bottom-[3px] left-0 h-px bg-gold transition-all duration-300',
                      active ? 'w-full' : 'w-0 group-hover:w-full',
                    )}
                    aria-hidden="true"
                  />
                )

                return item.href.startsWith('/#') ? (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn('group relative', linkClass)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn('group relative', linkClass)}
                  >
                    {item.label}
                    {indicator}
                  </Link>
                )
              })}
            </nav>

            {/* RIGHT: CLIENT ACCESS */}
            <div className="flex shrink-0 items-center gap-3">

              <span className="hidden h-7 w-px bg-white/15 xl:block" />

              {isAuthenticated ? (

                <Link
                  href="/portal"
                  className={cn(
                    'group inline-flex min-h-10 items-center gap-3',
                    'border border-gold/50 px-4 sm:px-5',
                    'text-[9px] font-semibold uppercase tracking-[0.16em]',
                    'text-gold transition-all duration-300',
                    'hover:border-gold hover:bg-gold hover:text-forest-deep',
                  )}
                >
                  <LockKeyhole className="h-3.5 w-3.5" />

                  <span className="hidden sm:inline">
                    Investor Suite
                  </span>

                  <span className="sm:hidden">
                    Investor
                  </span>

                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>

              ) : (

                <button
                  type="button"
                  onClick={() => open('signin')}
                  className={cn(
                    'group inline-flex min-h-10 items-center gap-3',
                    'border border-gold/50 px-4 sm:px-5',
                    'text-[9px] font-semibold uppercase tracking-[0.16em]',
                    'text-gold transition-all duration-300',
                    'hover:border-gold hover:bg-gold hover:text-forest-deep',
                  )}
                >
                  <LockKeyhole className="h-3.5 w-3.5" />

                  <span className="hidden sm:inline">
                    Client Sign In
                  </span>

                  <span className="sm:hidden">
                    Sign In
                  </span>

                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>

              )}

            </div>

          </div>
        </div>
      </div>

      {/* SECONDARY MOBILE NAVIGATION */}
      <div className="border-b border-white/10 bg-forest-deep/90 backdrop-blur-lg xl:hidden">

        <nav
          aria-label="Mobile navigation"
          className="mx-auto max-w-[1600px]"
        >

          <ul className="portal-scroll flex items-center gap-2 overflow-x-auto px-5 py-3 sm:px-8">

            {MOBILE_ITEMS.map((item) => {
              const active = isActive(pathname, item.href)

              const classes = cn(
                'inline-flex min-h-8 shrink-0 items-center',
                'border px-3.5 py-1.5',
                'text-[9px] font-medium uppercase tracking-[0.13em]',
                'transition-all duration-200',
                active
                  ? 'border-gold/60 bg-gold/10 text-gold'
                  : 'border-white/15 text-ivory/60 hover:border-gold/50 hover:text-gold',
              )

              return (
                <li key={item.href} className="shrink-0">

                  {item.href.startsWith('/#') ? (
                    <a href={item.href} className={classes}>
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={classes}
                    >
                      {item.label}
                    </Link>
                  )}

                </li>
              )
            })}

          </ul>

        </nav>
      </div>

      {/* INSTITUTIONAL IDENTITY STRIP */}
      <div className="hidden border-b border-white/5 bg-forest-deep/70 lg:block">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-12 py-2">

          <p className="text-[8px] font-medium uppercase tracking-[0.28em] text-ivory/35">
            Institutional Real Estate Advisory
          </p>

          <p className="text-[8px] uppercase tracking-[0.24em] text-ivory/35">
            Discreet
            <span className="mx-2 text-gold/70">·</span>
            Strategic
            <span className="mx-2 text-gold/70">·</span>
            Institutional
            <span className="mx-2 text-gold/70">·</span>
            Exceptional
          </p>

        </div>
      </div>

    </header>
  )
}
