'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {Loader2, Save} from 'lucide-react'
import {CURRENCY_OPTIONS} from '@/lib/constants'
import {cn} from '@/lib/utils'

const input = 'w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-gold focus:outline-none'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground'

export interface ProfileForm {
  fullName: string
  jobTitle: string
  nationality: string
  countryResidence: string
  phone: string
  capitalCurrency: string
  equityAvailable: number | null
  totalCapacity: number | null
  capitalFloor: number | null
  capitalCeiling: number | null
}

export interface PrefsForm {
  notifyOrders: boolean
  notifyMatches: boolean
  notifyDocuments: boolean
  notifyMessages: boolean
}

export default function ProfileEditor({profile, prefs}: {profile: ProfileForm; prefs: PrefsForm}) {
  const router = useRouter()
  const [form, setForm] = useState(profile)
  const [prefForm, setPrefForm] = useState(prefs)
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState('')

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({...f, [key]: value}))
    setSavedAt('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          ...form,
          jobTitle: form.jobTitle || null,
          nationality: form.nationality || null,
          countryResidence: form.countryResidence || null,
          phone: form.phone || null,
        }),
      })
      await fetch('/api/profile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(prefForm),
      })
      setSavedAt(new Date().toLocaleTimeString('en-GB'))
      router.refresh()
    } catch {
      /* surfaced by empty savedAt */
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: keyof PrefsForm) => setPrefForm((p) => ({...p, [key]: !p[key]}))

  return (
    <form onSubmit={save} className="space-y-8">
      <section className="grid gap-5 border border-border bg-card p-6 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <label className="block">
            <span className={label}>Full name</span>
            <input className={input} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className={label}>Role / title</span>
            <input className={input} value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} maxLength={120} />
          </label>
          <label className="block">
            <span className={label}>Nationality</span>
            <input className={input} value={form.nationality} onChange={(e) => set('nationality', e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className={label}>Country of residence</span>
            <input className={input} value={form.countryResidence} onChange={(e) => set('countryResidence', e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className={label}>Telephone</span>
            <input className={input} value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} />
          </label>
          <label className="block">
            <span className={label}>Reporting currency</span>
            <select className={input} value={form.capitalCurrency} onChange={(e) => set('capitalCurrency', e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.value}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Equity available</span>
            <input
              inputMode="decimal"
              className={`${input} tabular`}
              value={form.equityAvailable ?? ''}
              onChange={(e) => set('equityAvailable', e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null)}
              placeholder="—"
            />
          </label>
          <label className="block">
            <span className={label}>Total capacity</span>
            <input
              inputMode="decimal"
              className={`${input} tabular`}
              value={form.totalCapacity ?? ''}
              onChange={(e) => set('totalCapacity', e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null)}
              placeholder="—"
            />
          </label>
          <label className="block">
            <span className={label}>Typical ticket — from</span>
            <input
              inputMode="decimal"
              className={`${input} tabular`}
              value={form.capitalFloor ?? ''}
              onChange={(e) => set('capitalFloor', e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null)}
              placeholder="—"
            />
          </label>
          <label className="block">
            <span className={label}>to</span>
            <input
              inputMode="decimal"
              className={`${input} tabular`}
              value={form.capitalCeiling ?? ''}
              onChange={(e) => set('capitalCeiling', e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null)}
              placeholder="—"
            />
          </label>
        </div>
      </section>

      <section className="border border-border bg-card p-6">
        <h3 className="mb-2 font-display text-lg text-primary">Communication preferences</h3>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Intelligent, non-spammy signals only — each class maps to genuinely material events.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['notifyOrders', 'Order & payment status', 'Preparation milestones, payment verification, delivery and tracking.'],
              ['notifyMatches', 'New opportunity matches', 'High-signal matches against your criteria and saved searches.'],
              ['notifyDocuments', 'Document & data-room events', 'Grants, fulfilment of requests, new filings.'],
              ['notifyMessages', 'Advisor messages & enquiries', 'Replies from your Murivest advisor.'],
            ] as const
          ).map(([key, title, body]) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-pressed={prefForm[key]}
                className={cn('flex w-full items-start gap-3 border p-4 text-left transition-colors', prefForm[key] ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/50')}
              >
                <span className={cn('mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center border text-[10px]', prefForm[key] ? 'border-gold bg-gold text-forest-deep' : 'border-border text-transparent')}>
                  ✓
                </span>
                <span>
                  <span className="block text-sm font-medium text-primary">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center justify-end gap-4">
        {savedAt ? <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Saved at {savedAt}</span> : null}
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground hover:bg-forest-deep disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile
        </button>
      </div>
    </form>
  )
}
