'use client'

import Link from 'next/link'
import {ArrowRight} from 'lucide-react'
import {useAuthModal} from './AuthModalProvider'

/** Landing header: wordmark + anchors + client-access control. */
export default function LandingHeader({isAuthenticated}: {isAuthenticated: boolean}) {
  const {open} = useAuthModal()
  return (
    <header className="sticky top-0 z-40 border-b border-ivory/10 bg-forest-deep/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl font-semibold tracking-[0.08em] text-ivory">MURIVEST</span>
          <span className="gold-rule w-10" aria-hidden="true" />
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-ivory/50 sm:block">Private Capital Portal</span>
        </div>

        <nav className="hidden items-center gap-8 text-[11px] font-medium uppercase tracking-[0.18em] text-ivory/70 lg:flex" aria-label="Landing">
          <a href="#platform" className="transition-colors hover:text-gold">Platform</a>
          <a href="#access" className="transition-colors hover:text-gold">Access</a>
          <a href="#coverage" className="transition-colors hover:text-gold">Coverage</a>
          <a href="#standard" className="transition-colors hover:text-gold">Standard</a>
          <a href="#contact" className="transition-colors hover:text-gold">Contact</a>
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
    </header>
  )
}
