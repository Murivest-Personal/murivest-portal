'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {ArrowRight} from 'lucide-react'
import {useAuthModal} from './AuthModalProvider'
import {cn} from '@/lib/utils'

/**
 * Landing header: wordmark + page routes + client-access control.
 * Routes every public surface: Differential Underwriting, the calculator,
 * Insights and the UHNW desk — with landing anchors preserved via absolute
 * "/#…" paths so the header works on every page, not just the landing.
 */

const NAV_ITEMS = [
  {label: 'Underwriting', href: '/differential-underwriting'},
  {label: 'Calculator', href: '/underwriting-calculator'},
  {label: 'Insights', href: '/insights'},
  {label: 'UHNW desk', href: '/billionaire-real-estate'},
  {label: 'Contact', href: '/#contact'},
]

/** Mobile sub-nav — pill row, horizontally scrollable, no hamburger needed. */
const MOBILE_ITEMS = [
  ...NAV_ITEMS,
  {label: 'The letter', href: '/#letter'},
  {label: 'Access', href: '/#access'},
]

function isActive(pathname: string, href: string) {
  if (href.startsWith('/#')) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function LandingHeader({isAuthenticated}: {isAuthenticated: boolean}) {
  const {open} = useAuthModal()
  const pathname = usePathname() ?? '/'

  return (
    <header className="sticky top-0 z-40 border-b border-ivory/10 bg-forest-deep/95 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3" aria-label="Murivest home">
              <span className="font-display text-xl font-semibold tracking-[0.08em] text-ivory">MURIVEST</span>
              <span className="gold-rule w-10" aria-hidden="true" />
              <span className="hidden text-[10px] uppercase tracking-[0.22em] text-ivory/50 sm:block">Private Capital Portal</span>
            </Link>
          </div>

          <nav
            className="hidden items-center gap-7 text-[11px] font-medium uppercase tracking-[0.18em] text-ivory/70 lg:flex"
            aria-label="Primary"
          >
            {NAV_ITEMS.map((item) =>
              item.href.startsWith('/#') ? (
                <a key={item.href} href={item.href} className="transition-colors hover:text-gold">
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'transition-colors hover:text-gold',
                    isActive(pathname, item.href) && 'text-gold',
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/portal"
                className="inline-flex items-center gap-2 border border-gold/60 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-forest-deep"
              >
                Enter workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => open('signin')}
                className="border border-ivory/30 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory/90 transition-colors hover:border-gold hover:text-gold"
              >
                Client sign-in
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile / tablet sub-navigation */}
      <nav
        className="border-t border-ivory/10 lg:hidden"
        aria-label="Sections"
      >
        <ul className="portal-scroll flex items-center gap-2 overflow-x-auto px-6 py-3">
          {MOBILE_ITEMS.map((item) =>
            item.href.startsWith('/#') ? (
              <li key={item.href} className="flex-shrink-0">
                <a
                  href={item.href}
                  className="inline-flex items-center rounded-[9999px] border border-ivory/25 px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ivory/70 transition-colors hover:border-gold hover:text-gold"
                >
                  {item.label}
                </a>
              </li>
            ) : (
              <li key={item.href} className="flex-shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    'inline-flex items-center rounded-[9999px] border px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors hover:border-gold hover:text-gold',
                    isActive(pathname, item.href) ? 'border-gold/60 bg-gold/15 text-gold' : 'border-ivory/25 text-ivory/70',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>
    </header>
  )
}
