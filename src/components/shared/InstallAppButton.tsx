'use client'

import {useEffect, useState} from 'react'
import {Download, MonitorSmartphone, Smartphone, X} from 'lucide-react'

/**
 * PWA install affordance — "download" the portal onto phone and desktop.
 *
 *  • Desktop Chrome/Edge + Android Chrome: captures beforeinstallprompt and
 *    triggers the native install flow ("Install app").
 *  • iPhone/iPad Safari (iOS 16.4+): Web Push and install both live behind
 *    Add to Home Screen, which cannot be scripted — the button opens short
 *    instructions instead.
 *  • Already running installed (display-mode: standalone) → renders nothing.
 *
 * Two renderings: variant="compact" for the shell headers, variant="full"
 * for the notification settings page.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & {standalone?: boolean}).standalone === true
  return window.matchMedia?.('(display-mode: standalone)').matches || iosStandalone
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS masquerades as macOS Safari — catch it via touch support.
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

function IosInstructions({onClose}: {onClose?: () => void}) {
  return (
    <div className="flex items-start gap-3">
      <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-snug text-primary">Add to your Home Screen</p>
        <ol className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
          <li>1. Tap the Share button in Safari&apos;s toolbar.</li>
          <li>2. Choose &ldquo;Add to Home Screen&rdquo;.</li>
          <li>3. Open Murivest from your Home Screen.</li>
        </ol>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/80">
          Installed on iOS 16.4 or later, notifications reach this device even when the portal is closed.
        </p>
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground/60 hover:text-primary">
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
}

export default function InstallAppButton({variant = 'compact'}: {variant?: 'compact' | 'full'}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      return
    }
    setIos(isIos())
    const onPrompt = (e: Event) => {
      e.preventDefault() // keep the browser's own mini-infobar out of the way
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!deferred) {
      setHintOpen((v) => !v)
      return
    }
    setBusy(true)
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
    } catch {
      /* browser refused the prompt — user can still install from the menu */
    } finally {
      setBusy(false)
      setDeferred(null)
    }
  }

  if (installed || dismissed) return null
  const offerInstall = deferred !== null || ios

  if (variant === 'compact') {
    if (!offerInstall && !hintOpen) return null
    return (
      <div>
        <button
          type="button"
          onClick={install}
          disabled={busy}
          aria-label={deferred ? 'Install the Murivest portal app' : 'How to install on this device'}
          className="relative inline-flex h-9 items-center gap-2 border border-border px-3 text-primary transition-colors hover:border-gold hover:text-gold"
        >
          <Download className="h-4 w-4" />
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] sm:inline">{busy ? 'Installing…' : 'Install app'}</span>
        </button>
        {ios && hintOpen ? (
          <div className="absolute right-5 top-[4.5rem] z-50 w-80 max-w-[calc(100vw-2.5rem)] rounded-card border border-border bg-card shadow-card p-4 shadow-xl">
            <IosInstructions onClose={() => setHintOpen(false)} />
          </div>
        ) : null}
      </div>
    )
  }

  // variant === 'full' — notification settings page row.
  return (
    <div className="relative flex items-start gap-3 px-4 py-3">
      <MonitorSmartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-primary">Install on this device</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {offerInstall
            ? 'Add the portal to your phone or desktop home screen — a full-screen app whose notifications reach you even when it is closed.'
            : 'This browser installs apps from its own menu (Chrome/Edge: address-bar install icon; Safari: File → Add to Dock).'}
        </p>
        {offerInstall ? (
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={install}
              disabled={busy}
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold hover:underline disabled:opacity-50"
            >
              {ios ? 'How to install' : busy ? 'Installing…' : 'Install app'}
            </button>
          </div>
        ) : null}
        {ios && hintOpen ? (
          <div className="mt-3 border border-border bg-background p-3">
            <IosInstructions />
          </div>
        ) : null}
      </div>
    </div>
  )
}
