'use client'

import {useState, useEffect} from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {X, ArrowRight, Loader2, ShieldCheck, KeyRound, Mail, Lock, User, Building2, Sparkles, Landmark} from 'lucide-react'
import {Wordmark} from '@/components/brand/Wordmark'

/**
 * Authentication modal — the single gateway into the private environment.
 * Sign in (password + optional TOTP, magic link) · Register (lightweight,
 * classification-aware) · Request private access (invitation-oriented).
 */

type Mode = 'signin' | 'register' | 'access'
type Intent = 'individual' | 'uhnwi' | 'institutional_rep'

const input =
  'w-full border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-gold focus:outline-none'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground'

export default function AuthModal({
  open,
  onClose,
  initialMode = 'signin',
}: {
  open: boolean
  onClose: () => void
  initialMode?: Mode
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [devLink, setDevLink] = useState('')

  // Sign-in state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [totp, setTotp] = useState('')
  const [magicRequested, setMagicRequested] = useState(false)

  // Register state
  const [fullName, setFullName] = useState('')
  const [intent, setIntent] = useState<Intent>('uhnwi')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  useEffect(() => {
    if (open) {
      setError('')
      setNotice('')
      setDevLink('')
      setMfaRequired(false)
      setMagicRequested(false)
    }
  }, [open, mode])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('auth') === 'required' && open) {
      setNotice('This area requires authentication. Sign in or request private access.')
    }
  }, [open])

  if (!open) return null

  async function submitSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mfaRequired) {
        const res = await fetch('/api/auth/mfa', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({action: 'challenge', code: totp}),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setError(data.error || 'Verification failed.')
          return
        }
        router.push(data.next === 'onboarding' ? '/portal/onboarding' : '/portal')
        router.refresh()
        return
      }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Sign-in failed.')
        return
      }
      if (data.mfaRequired) {
        setMfaRequired(true)
        return
      }
      router.push(data.next === 'onboarding' ? '/portal/onboarding' : '/portal')
      router.refresh()
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function requestMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Enter your email first.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email}),
      })
      const data = await res.json()
      setMagicRequested(true)
      setNotice(data.message || 'If that address is registered, a sign-in link is on its way.')
      if (data.devLink) setDevLink(data.devLink)
    } catch {
      setError('Could not request the link. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({fullName, email: regEmail, password: regPassword, intent}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Registration failed.')
        return
      }
      if (data.devLink) setDevLink(data.devLink)
      router.push('/portal/onboarding')
      router.refresh()
    } catch {
      setError('Registration failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitAccessRequest(e: React.FormEvent) {
    e.preventDefault()
    // Access requests route through registration with institutional intent;
    // the desk then verifies and invites. Same secure path, curated outcome.
    setMode('register')
    setIntent('institutional_rep')
    setNotice('Complete registration to submit your access request for review by our investor-relations desk.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Authentication">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-forest-deep/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 my-8 w-full max-w-md border border-gold/25 bg-card shadow-2xl">
        {/* Head */}
        <div className="flex items-start justify-between border-b border-border bg-primary px-6 py-5">
          <div>
            <Wordmark size="sm" tone="ivory" />
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ivory/60">
              {mode === 'signin' ? 'Client access' : mode === 'register' ? 'New investor onboarding' : 'Private access request'}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-ivory/60 transition-colors hover:text-gold">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="grid grid-cols-3 border-b border-border text-center text-[11px] uppercase tracking-[0.14em]">
          {(['signin', 'register', 'access'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setError('')
                setNotice('')
              }}
              className={`px-2 py-3 transition-colors ${mode === m ? 'bg-gold/10 font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {m === 'signin' ? 'Sign in' : m === 'register' ? 'Register' : 'Request access'}
            </button>
          ))}
        </div>

        <div className="px-6 py-6">
          {notice ? <div className="mb-4 border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">{notice}</div> : null}
          {devLink ? (
            <div className="mb-4 border border-gold/30 bg-secondary px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-primary">Development mode:</span>{' '}
              <Link href={devLink} className="break-all font-mono text-gold underline">
                {devLink}
              </Link>
            </div>
          ) : null}
          {error ? <div className="mb-4 border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}

          {/* ---------------- SIGN IN ---------------- */}
          {mode === 'signin' && !mfaRequired && (
            <form onSubmit={submitSignIn} className="space-y-4">
              <div>
                <label className={label} htmlFor="signin-email">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <input id="signin-email" type="email" autoComplete="email" required className={`${input} pl-10`} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={label} htmlFor="signin-password">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <input id="signin-password" type="password" autoComplete="current-password" required className={`${input} pl-10`} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {busy ? 'Verifying…' : 'Enter workspace'}
              </button>
              <div className="flex items-center gap-3 py-1">
                <span className="gold-rule flex-1" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">or</span>
                <span className="gold-rule flex-1" />
              </div>
              <button type="button" onClick={requestMagicLink} disabled={busy || magicRequested} className="inline-flex w-full items-center justify-center gap-2 border border-border px-6 py-3 text-xs font-medium uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold disabled:opacity-60">
                <Sparkles className="h-4 w-4" />
                {magicRequested ? 'Link sent' : 'Email me a sign-in link'}
              </button>
              <button type="button" onClick={() => window.location.href = '/reset-password'} className="block w-full pt-1 text-center text-xs text-muted-foreground underline-offset-4 hover:text-gold hover:underline">
                Forgot your password?
              </button>
            </form>
          )}

          {/* ---------------- MFA CHALLENGE ---------------- */}
          {mode === 'signin' && mfaRequired && (
            <form onSubmit={submitSignIn} className="space-y-4">
              <div className="border border-gold/30 bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">
                <ShieldCheck className="mr-2 inline h-4 w-4 text-gold" />
                Two-factor authentication is enabled on this account. Enter the current 6-digit code from your authenticator.
              </div>
              <div>
                <label className={label} htmlFor="totp">Authentication code</label>
                <input id="totp" inputMode="numeric" pattern="\d{6}" maxLength={6} required className={`${input} text-center font-mono text-lg tracking-[0.4em]`} value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
              </div>
              <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? 'Verifying…' : 'Complete sign-in'}
              </button>
              <button type="button" onClick={() => setMfaRequired(false)} className="block w-full text-center text-xs text-muted-foreground hover:text-gold">
                ← Back
              </button>
            </form>
          )}

          {/* ---------------- REGISTER ---------------- */}
          {mode === 'register' && (
            <form onSubmit={submitRegister} className="space-y-4">
              <div>
                <label className={label}>I am registering as</label>
                <div className="grid gap-2">
                  {(
                    [
                      {value: 'individual', icon: User, label: 'Private investor', hint: 'Individual account'},
                      {value: 'uhnwi', icon: Landmark, label: 'UHNWI / family office', hint: 'Personal or family capital'},
                      {value: 'institutional_rep', icon: Building2, label: 'Institutional representative', hint: 'Fund, corporate, endowment'},
                    ] as {value: Intent; icon: typeof User; label: string; hint: string}[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIntent(opt.value)}
                      className={`flex items-center gap-3 border px-4 py-3 text-left transition-colors ${intent === opt.value ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/50'}`}
                    >
                      <opt.icon className={`h-5 w-5 ${intent === opt.value ? 'text-gold' : 'text-muted-foreground'}`} />
                      <span>
                        <span className="block text-sm font-medium text-primary">{opt.label}</span>
                        <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label} htmlFor="reg-name">Full name</label>
                <input id="reg-name" type="text" autoComplete="name" required minLength={2} className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="reg-email">Email</label>
                <input id="reg-email" type="email" autoComplete="email" required className={input} value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="reg-password">Password</label>
                <input id="reg-password" type="password" autoComplete="new-password" required className={input} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">10+ characters with upper &amp; lower case, a number and a symbol. Verification and classification continue inside the portal — confidential material unlocks progressively.</p>
              </div>
              <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          {/* ---------------- REQUEST ACCESS ---------------- */}
          {mode === 'access' && (
            <form onSubmit={submitAccessRequest} className="space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Murivest grants portal access selectively. Submit your details for review by our investor-relations desk —
                we will verify your classification, complete KYC/AML formalities, and extend a private invitation.
              </p>
              <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" /> Fiduciary standard engagements, mandate-only scope</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" /> KYC/AML verification before confidential access</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" /> No pooled capital, no collective schemes</li>
              </ul>
              <button type="submit" className="inline-flex w-full items-center justify-center gap-2 bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-forest-deep transition-colors hover:bg-gold-deep hover:text-ivory">
                <Building2 className="h-4 w-4" />
                Begin private access request
              </button>
            </form>
          )}
        </div>

        <div className="border-t border-border bg-secondary/50 px-6 py-3 text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Confidential environment · {new Date().getFullYear()} Murivest Group Ltd
        </div>
      </div>
    </div>
  )
}
