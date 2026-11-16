'use client'

import {useState} from 'react'
import {useSearchParams} from 'next/navigation'
import {useRouter} from 'next/navigation'
import {KeyRound, Loader2} from 'lucide-react'

const input =
  'w-full rounded-standard border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground'

export default function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const [stage, setStage] = useState<'request' | 'set'>(params.get('token') ? 'set' : 'request')
  const [email, setEmail] = useState('')
  const [token] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [devLink, setDevLink] = useState('')

  async function requestLink(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'forgot', email}),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setNotice(data.message || 'If that address is registered, reset instructions have been sent.')
      if (data.devLink) setDevLink(data.devLink)
    } catch {
      setError('Request failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'reset', token, password}),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Reset failed.')
        return
      }
      setNotice('Password updated. All sessions were signed out — sign in with your new password.')
      setTimeout(() => router.push('/'), 2500)
    } catch {
      setError('Reset failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-border bg-card p-8 shadow-sm">
      {notice ? <div className="mb-4 border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">{notice}</div> : null}
      {devLink ? (
        <div className="mb-4 border border-gold/30 bg-secondary px-4 py-3 text-xs text-muted-foreground">
          <span className="font-medium text-primary">Development mode:</span>{' '}
          <a href={devLink} className="break-all font-mono text-gold underline">
            {devLink}
          </a>
        </div>
      ) : null}
      {error ? <div className="mb-4 border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}

      {stage === 'request' ? (
        <form onSubmit={requestLink} className="space-y-4">
          <div>
            <label className={label} htmlFor="reset-email">Account email</label>
            <input id="reset-email" type="email" required autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Send reset link
          </button>
        </form>
      ) : (
        <form onSubmit={setNewPassword} className="space-y-4">
          <div>
            <label className={label} htmlFor="new-password">New password</label>
            <input id="new-password" type="password" required autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1.5 text-[11px] text-muted-foreground">10+ characters, upper &amp; lower case, a number and a symbol.</p>
          </div>
          <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Set new password
          </button>
        </form>
      )}
    </div>
  )
}
