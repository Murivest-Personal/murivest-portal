'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {ArrowLeft, ArrowRight, Building2, Check, Landmark, Loader2, ShieldCheck, User} from 'lucide-react'
import {cn} from '@/lib/utils'

const input =
  'w-full rounded-standard border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary'
const label = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground'

export interface OnboardingDefaults {
  classification: string
  jobTitle: string
  nationality: string
  countryResidence: string
  phone: string
  capitalCurrency: string
  equityAvailable: number | null
  totalCapacity: number | null
  capitalFloor: number | null
  capitalCeiling: number | null
  organisationName: string
  organisationType: string
  source: string
  emailVerified: boolean
}

const STEPS = ['Classification', 'Identity', 'Capacity', 'Objectives', 'Review'] as const

export default function OnboardingWizard({defaults}: {defaults: OnboardingDefaults}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [classification, setClassification] = useState(defaults.classification)
  const [jobTitle, setJobTitle] = useState(defaults.jobTitle)
  const [nationality, setNationality] = useState(defaults.nationality)
  const [countryResidence, setCountryResidence] = useState(defaults.countryResidence)
  const [phone, setPhone] = useState(defaults.phone)
  const [organisationName, setOrganisationName] = useState(defaults.organisationName)
  const [organisationType, setOrganisationType] = useState(defaults.organisationType)
  const [capitalCurrency, setCapitalCurrency] = useState(defaults.capitalCurrency)
  const [equityAvailable, setEquityAvailable] = useState(defaults.equityAvailable?.toString() || '')
  const [totalCapacity, setTotalCapacity] = useState(defaults.totalCapacity?.toString() || '')
  const [capitalFloor, setCapitalFloor] = useState(defaults.capitalFloor?.toString() || '')
  const [capitalCeiling, setCapitalCeiling] = useState(defaults.capitalCeiling?.toString() || '')
  const [objectives, setObjectives] = useState('')
  const [source, setSource] = useState(defaults.source)

  async function persistStep(nextStep: number, submit: boolean) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          step: nextStep,
          ...(step === 0 ? {classification} : {}),
          ...(step === 1
            ? {
                jobTitle,
                nationality,
                countryResidence,
                phone,
                ...(classification === 'institutional_rep' ? {organisationName, organisationType} : {}),
              }
            : {}),
          ...(step === 2
            ? {
                capitalCurrency,
                equityAvailable: equityAvailable ? Number(equityAvailable) : undefined,
                totalCapacity: totalCapacity ? Number(totalCapacity) : undefined,
                capitalFloor: capitalFloor ? Number(capitalFloor) : undefined,
                capitalCeiling: capitalCeiling ? Number(capitalCeiling) : undefined,
              }
            : {}),
          ...(step === 3 ? {objectives, source} : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not save this step.')
        return
      }
      if (submit) {
        router.push('/portal?welcomed=1')
        router.refresh()
        return
      }
      setStep(nextStep)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Stepper */}
      <ol className="mb-10 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="text-center">
            <div
              className={cn(
                'mx-auto flex h-8 w-8 items-center justify-center border text-xs font-semibold',
                i < step ? 'border-gold bg-gold/15 text-primary' : i === step ? 'border-primary bg-primary text-ivory' : 'border-border text-muted-foreground',
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className={cn('mt-1.5 text-[9px] uppercase tracking-[0.14em]', i === step ? 'text-primary' : 'text-muted-foreground/70')}>{s}</div>
          </li>
        ))}
      </ol>

      {error ? <div className="mb-5 border-l-2 border-destructive bg-red-50 px-4 py-3 text-xs text-destructive">{error}</div> : null}
      {!defaults.emailVerified ? (
        <div className="mb-5 border-l-2 border-gold bg-gold/5 px-4 py-3 text-xs leading-relaxed text-primary">
          <ShieldCheck className="mr-2 inline h-4 w-4 text-gold" />
          Your email is not yet verified — check your inbox for the verification link. Onboarding continues in the meantime; confidential tiers unlock after verification and review.
        </div>
      ) : null}

      {/* Step 1 — Classification */}
      {step === 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl text-primary">How will you be allocating?</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Your classification shapes verification, the opportunities surfaced to you, and the advisory relationship.</p>
          <div className="grid gap-3">
            {(
              [
                {value: 'individual', icon: User, title: 'Private investor', body: 'Personal capital into direct commercial assets.'},
                {value: 'uhnwi', icon: Landmark, title: 'UHNWI / family office', body: 'Substantial personal or family capital; family-office standards expected.'},
                {value: 'institutional_rep', icon: Building2, title: 'Institutional representative', body: 'You act for a fund, corporate, endowment or similar allocator.'},
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setClassification(opt.value)}
                className={cn('flex items-start gap-4 border p-5 text-left transition-colors', classification === opt.value ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/50')}
              >
                <opt.icon className={cn('mt-0.5 h-6 w-6', classification === opt.value ? 'text-gold' : 'text-muted-foreground')} strokeWidth={1.5} />
                <span>
                  <span className="block font-display text-lg text-primary">{opt.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{opt.body}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => persistStep(1, false)} disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Step 2 — Identity */}
      {step === 1 && (
        <section className="space-y-5">
          <h2 className="font-display text-2xl text-primary">Identity & organisation</h2>
          <p className="text-sm text-muted-foreground">Verified against KYC documentation during review. Accuracy here accelerates your access tier.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="ob-jobtitle">Role / title</label>
              <input id="ob-jobtitle" className={input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Principal, CIO, Director…" />
            </div>
            <div>
              <label className={label} htmlFor="ob-phone">Telephone</label>
              <input id="ob-phone" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 … / +44 …" />
            </div>
            <div>
              <label className={label} htmlFor="ob-nationality">Nationality</label>
              <input id="ob-nationality" className={input} value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="ob-residence">Country of residence</label>
              <input id="ob-residence" className={input} value={countryResidence} onChange={(e) => setCountryResidence(e.target.value)} />
            </div>
            {classification === 'institutional_rep' && (
              <>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="ob-org">Organisation legal name</label>
                  <input id="ob-org" className={input} value={organisationName} onChange={(e) => setOrganisationName(e.target.value)} placeholder="Family office, fund, corporate…" />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Organisation type</label>
                  <select className={input} value={organisationType} onChange={(e) => setOrganisationType(e.target.value)}>
                    <option value="family_office">Family office</option>
                    <option value="fund">Fund / investment firm</option>
                    <option value="corporate">Corporate</option>
                    <option value="endowment">Endowment / foundation</option>
                    <option value="pension">Pension</option>
                    <option value="institution">Institution</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(0)} className="inline-flex items-center gap-2 border border-border px-6 py-3 text-xs uppercase tracking-[0.16em] text-primary hover:border-gold hover:text-gold">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => persistStep(2, false)} disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Step 3 — Capacity */}
      {step === 2 && (
        <section className="space-y-5">
          <h2 className="font-display text-2xl text-primary">Deployment capacity</h2>
          <p className="text-sm text-muted-foreground">
            Self-declared figures guide matching and capital-gap analysis. They are verified during KYC and never displayed to other investors.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="ob-currency">Reporting currency</label>
              <select id="ob-currency" className={input} value={capitalCurrency} onChange={(e) => setCapitalCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="KES">KES</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="ob-equity">Equity available today</label>
              <input id="ob-equity" inputMode="decimal" className={input} value={equityAvailable} onChange={(e) => setEquityAvailable(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 25000000" />
            </div>
            <div>
              <label className={label} htmlFor="ob-capacity">Total programme capacity</label>
              <input id="ob-capacity" inputMode="decimal" className={input} value={totalCapacity} onChange={(e) => setTotalCapacity(e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 120000000" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="ob-floor">Typical ticket — from</label>
                <input id="ob-floor" inputMode="decimal" className={input} value={capitalFloor} onChange={(e) => setCapitalFloor(e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
              <div>
                <label className={label} htmlFor="ob-ceiling">to</label>
                <input id="ob-ceiling" inputMode="decimal" className={input} value={capitalCeiling} onChange={(e) => setCapitalCeiling(e.target.value.replace(/[^\d.]/g, ''))} />
              </div>
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 border border-border px-6 py-3 text-xs uppercase tracking-[0.16em] text-primary hover:border-gold hover:text-gold">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => persistStep(3, false)} disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Step 4 — Objectives */}
      {step === 3 && (
        <section className="space-y-5">
          <h2 className="font-display text-2xl text-primary">Objectives & source</h2>
          <div>
            <label className={label} htmlFor="ob-objectives">Investment objectives — in your words</label>
            <textarea
              id="ob-objectives"
              className={`${input} min-h-32`}
              maxLength={4000}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="Markets of interest, income versus capital-gain emphasis, hold horizons, structures you would consider (direct, JV, preferred equity)…"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Structured criteria — yields, hold periods, leverage — are set in the Investment Studio after onboarding.</p>
          </div>
          <div>
            <label className={label} htmlFor="ob-source">How did you find Murivest?</label>
            <input id="ob-source" className={input} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Referral, auction platform, research, advisor…" />
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="inline-flex items-center gap-2 border border-border px-6 py-3 text-xs uppercase tracking-[0.16em] text-primary hover:border-gold hover:text-gold">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => persistStep(4, false)} disabled={busy} className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Step 5 — Review & submit */}
      {step === 4 && (
        <section className="space-y-5">
          <h2 className="font-display text-2xl text-primary">Submit for verification</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Review your intake. On submission, our compliance desk performs KYC/AML verification and assigns your access tier. Tier 1 access (standard listings) is available immediately; confidential material follows verification and NDA acceptance.
          </p>
          <dl className="divide-y divide-border border border-border bg-card text-sm">
            <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3">
              <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Classification</dt>
              <dd className="text-primary">{classification === 'uhnwi' ? 'UHNWI / family office' : classification === 'institutional_rep' ? `Institutional representative${organisationName ? ` — ${organisationName}` : ''}` : 'Private investor'}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3">
              <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Residence</dt>
              <dd className="text-primary">{countryResidence || '—'} {nationality ? `· ${nationality}` : ''}</dd>
            </div>
            <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3">
              <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Capacity</dt>
              <dd className="tabular text-primary">
                {equityAvailable ? `${capitalCurrency} ${Number(equityAvailable).toLocaleString()} available today` : '—'}
                {totalCapacity ? ` · ${capitalCurrency} ${Number(totalCapacity).toLocaleString()} programme` : ''}
              </dd>
            </div>
            {objectives ? (
              <div className="grid grid-cols-[160px_1fr] gap-4 px-5 py-3">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Objectives</dt>
                <dd className="line-clamp-3 text-primary">{objectives}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 border border-border px-6 py-3 text-xs uppercase tracking-[0.16em] text-primary hover:border-gold hover:text-gold">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => persistStep(5, true)} disabled={busy} className="inline-flex items-center gap-2 bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-forest-deep transition-colors hover:bg-gold-deep hover:text-ivory disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Submit for verification
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
