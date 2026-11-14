'use client'

import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {Loader2, ShieldCheck, Smartphone, KeyRound, LogOut} from 'lucide-react'
import {fmtDateTime, relativeTime} from '@/lib/format'
import {cn} from '@/lib/utils'

const input = 'w-full border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-gold focus:outline-none'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground'

export interface SessionRow {
  id: string
  device: string | null
  ip: string | null
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

export interface SecurityEventRow {
  id: string
  type: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export default function SecurityPanel({
  mfaEnabled,
  sessions: initialSessions,
  events,
}: {
  mfaEnabled: boolean
  sessions: SessionRow[]
  events: SecurityEventRow[]
}) {
  const router = useRouter()
  const [sessions, setSessions] = useState(initialSessions)
  const [busy, setBusy] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // MFA setup
  const [mfaStep, setMfaStep] = useState<'idle' | 'scan' | 'enabled-off'>('idle')
  const [qr, setQr] = useState('')
  const [otpauth, setOtpauth] = useState('')
  const [totp, setTotp] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')

  useEffect(() => {
    if (mfaEnabled) setMfaStep('enabled-off')
  }, [mfaEnabled])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'change', currentPassword, newPassword}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Password change failed.')
        return
      }
      setMessage('Password updated. Other sessions remain signed in — review them below and revoke any you do not recognise.')
      setCurrentPassword('')
      setNewPassword('')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setPwBusy(false)
    }
  }

  async function startMfaSetup() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'setup'}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not start MFA setup.')
        return
      }
      setQr(data.qr)
      setOtpauth(data.otpauth)
      setMfaStep('scan')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function enableMfa(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'enable', code: totp}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'That code did not match — try the next one.')
        return
      }
      setMfaStep('enabled-off')
      setTotp('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'disable', code: disableCode, password: disablePassword}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not disable MFA.')
        return
      }
      setMfaStep('idle')
      setDisableCode('')
      setDisablePassword('')
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id?: string) {
    setBusy(true)
    try {
      await fetch('/api/auth/sessions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(id ? {action: 'revoke', sessionId: id} : {action: 'revoke_all'}),
      })
      const res = await fetch('/api/auth/sessions', {cache: 'no-store'})
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      {message ? <div className="border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs text-primary">{message}</div> : null}
      {error ? <div className="border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}

      {/* Password */}
      <section className="border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-gold" />
          <h2 className="font-display text-xl text-primary">Password</h2>
        </div>
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Current password</span>
            <input type="password" autoComplete="current-password" required className={input} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>New password</span>
            <input type="password" autoComplete="new-password" required className={input} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="mt-1 text-[10px] text-muted-foreground">10+ characters, upper &amp; lower case, a number and a symbol.</p>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={pwBusy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
              {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Update password
            </button>
          </div>
        </form>
      </section>

      {/* MFA */}
      <section className="border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-gold" />
          <h2 className="font-display text-xl text-primary">Two-factor authentication</h2>
          <span className={cn('ml-auto border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]', mfaStep === 'enabled-off' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground')}>
            {mfaStep === 'enabled-off' ? 'Enabled' : 'Not enabled'}
          </span>
        </div>

        {mfaStep === 'idle' ? (
          <div>
            <p className="mb-4 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Add a TOTP authenticator (Google Authenticator, 1Password, Authy…) as a second factor on every sign-in. Institutional accounts should treat this as mandatory.
            </p>
            <button type="button" onClick={startMfaSetup} disabled={busy} className="inline-flex items-center gap-2 border border-gold bg-gold/10 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-primary hover:bg-gold/20 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Begin setup
            </button>
          </div>
        ) : null}

        {mfaStep === 'scan' ? (
          <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
            <div>
              {qr ? (
                <img src={qr} alt="MFA setup QR code" width={220} height={220} className="border border-border bg-white p-2" />
              ) : null}
              <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
                Scan with your authenticator — or enter the key manually from the otpauth link below.
              </p>
            </div>
            <div>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                1 · Scan the code in your authenticator app. 2 · Enter the current 6-digit code to confirm and enable.
              </p>
              <form onSubmit={enableMfa} className="space-y-4">
                <label className="block">
                  <span className={label}>Verification code</span>
                  <input inputMode="numeric" pattern="\d{6}" maxLength={6} required value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} className={`${input} text-center font-mono text-lg tracking-[0.4em]`} placeholder="••••••" />
                </label>
                <div className="flex gap-3">
                  <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Enable MFA
                  </button>
                  <button type="button" onClick={() => setMfaStep('idle')} className="border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-gold">
                    Cancel
                  </button>
                </div>
              </form>
              <details className="mt-4 text-[10px] text-muted-foreground">
                <summary className="cursor-pointer uppercase tracking-[0.14em]">Manual entry key</summary>
                <code className="mt-1 block break-all font-mono text-[10px] text-primary">{otpauth}</code>
              </details>
            </div>
          </div>
        ) : null}

        {mfaStep === 'enabled-off' ? (
          <form onSubmit={disableMfa} className="max-w-xl">
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              MFA is active on your account. Disable it only with your password and a current code — a security notification is recorded and issued either way.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Current code</span>
                <input inputMode="numeric" pattern="\d{6}" maxLength={6} required value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))} className={`${input} text-center font-mono tracking-[0.3em]`} placeholder="••••••" />
              </label>
              <label className="block">
                <span className={label}>Password</span>
                <input type="password" required value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className={input} />
              </label>
            </div>
            <button type="submit" disabled={busy} className="mt-4 inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Disable MFA
            </button>
          </form>
        ) : null}
      </section>

      {/* Sessions */}
      <section className="border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-primary">Active sessions</h2>
          <button type="button" onClick={() => revoke()} disabled={busy} className="inline-flex items-center gap-2 border border-border px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-60">
            <LogOut className="h-3.5 w-3.5" /> Sign out everywhere else
          </button>
        </div>
        <ul className="divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-primary">
                  {s.device || 'Unknown device'}
                  {s.current ? <span className="ml-2 border border-gold/50 bg-gold/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-primary">this device</span> : null}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {s.ip || 'IP unrecorded'} · signed in {fmtDateTime(s.createdAt)} · last seen {relativeTime(s.lastSeenAt)}
                </div>
              </div>
              {!s.current ? (
                <button type="button" onClick={() => revoke(s.id)} disabled={busy} className="flex-shrink-0 border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-60">
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">New devices trigger a security notification automatically</p>
      </section>

      {/* Security events */}
      <section className="border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-xl text-primary">Security history</h2>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No security events recorded yet.</p>
        ) : (
          <ul className="portal-scroll max-h-80 divide-y divide-border overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span className="font-medium text-primary">{e.type.replace(/_/g, ' ')}</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {e.ip || '—'} · {fmtDateTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
