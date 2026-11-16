'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import {Bell, BellOff, Check, Clock, MonitorSmartphone, RotateCcw, ShieldAlert, Trash2} from 'lucide-react'
import {Switch} from '@/components/ui/switch'
import {cn} from '@/lib/utils'
import {relativeTime} from '@/lib/format'
import {CATEGORY_LABELS, NOTIFICATION_CATEGORIES, CHANNELS, CHANNEL_LABELS, type NotificationCategory, type NotificationChannel} from '@/lib/notifications/events'
import {getPushState, enablePush, disablePush, type PushState} from '@/lib/client/push'
import InstallAppButton from '@/components/shared/InstallAppButton'

/**
 * Full Notification Settings / preference centre.
 *
 * Layout: global switches → channel × category matrix (each cell toggles
 * independently and saves immediately) → this-device push management →
 * email delivery state. Security toggles carry an inline warning because
 * they are recommended always-on.
 */

type Matrix = Record<NotificationChannel, Record<NotificationCategory, boolean>>
type Explicit = Record<NotificationChannel, Partial<Record<NotificationCategory, boolean>>>

interface SettingsState {
  globalEnabled: boolean
  quietStartMin: number | null
  quietEndMin: number | null
  digestEnabled: boolean
  digestFrequency: 'daily' | 'weekly'
  emailSuppressed: boolean
}

interface PushDevice {
  id: string
  platform: string
  deviceLabel: string | null
  lastSeenAt: string
  createdAt: string
  endpoint: string
}

const CATEGORY_HINTS: Record<NotificationCategory, string> = {
  documents: 'Data-room uploads, shared access, expiring links',
  orders: 'Order confirmation, payment, brief progress & delivery',
  opportunities: 'New listings matching your criteria',
  studio: 'Saved scenario reminders and analysis signals',
  mandates: 'Mandate progress, milestones, linked opportunities',
  messages: 'Replies and notes from your Murivest advisor',
  security: 'Sign-ins, verification, tier changes — recommended always on',
  system: 'Rare, high-signal platform announcements',
}

// Quiet hours are stored as UTC minutes; the inputs show investor-local time.
const tzOffset = () => new Date().getTimezoneOffset()
const localToStored = (localMin: number) => (localMin + tzOffset() + 1440) % 1440
const storedToLocal = (storedMin: number) => (storedMin - tzOffset() + 1440) % 1440
const minToHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const hhmmToMin = (s: string) => {
  const [h, m] = s.split(':').map((x) => Number.parseInt(x, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

export default function NotificationSettings({email}: {email: string}) {
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [matrix, setMatrix] = useState<Matrix | null>(null)
  const [explicit, setExplicit] = useState<Explicit | null>(null)
  const [devices, setDevices] = useState<PushDevice[]>([])
  const [push, setPush] = useState<PushState | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState<string | null>(null)
  const [quietFrom, setQuietFrom] = useState<string | null>(null)
  const [quietTo, setQuietTo] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/settings', {cache: 'no-store'})
      if (!res.ok) return
      const data = await res.json()
      setSettings(data.settings)
      setMatrix(data.matrix)
      setExplicit(data.explicit)
      setDevices(data.pushSubscriptions ?? [])
      setQuietFrom(data.settings.quietStartMin != null ? minToHHMM(storedToLocal(data.settings.quietStartMin)) : null)
      setQuietTo(data.settings.quietEndMin != null ? minToHHMM(storedToLocal(data.settings.quietEndMin)) : null)
      setPush(await getPushState())
    } catch {
      /* offline — keep current state */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const flashSaved = () => setSavedAt(Date.now())
  useEffect(() => {
    if (savedAt === null) return
    const t = setTimeout(() => setSavedAt(null), 1800)
    return () => clearTimeout(t)
  }, [savedAt])

  const put = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.matrix) setMatrix(data.matrix)
        if (data.explicit) setExplicit(data.explicit)
        flashSaved()
      }
    } catch {
      /* offline — retry on next interaction */
    } finally {
      setBusy(false)
    }
  }, [])

  async function toggleCell(channel: NotificationChannel, category: NotificationCategory, enabled: boolean) {
    if (!matrix) return
    setMatrix({...matrix, [channel]: {...matrix[channel], [category]: enabled}})
    await put({matrix: [{channel, category, enabled}]})
  }

  async function toggleGlobal(enabled: boolean) {
    if (!settings) return
    setSettings({...settings, globalEnabled: enabled})
    await put({globalEnabled: enabled})
  }

  async function toggleDigest(enabled: boolean) {
    if (!settings) return
    setSettings({...settings, digestEnabled: enabled})
    await put({digestEnabled: enabled})
  }

  async function setFrequency(frequency: 'daily' | 'weekly') {
    if (!settings) return
    setSettings({...settings, digestFrequency: frequency})
    await put({digestFrequency: frequency})
  }

  async function saveQuietHours(from: string | null, to: string | null) {
    setQuietFrom(from)
    setQuietTo(to)
    if (from && to) {
      await put({quietStartMin: localToStored(hhmmToMin(from)), quietEndMin: localToStored(hhmmToMin(to))})
    } else {
      await put({quietStartMin: null, quietEndMin: null})
    }
  }

  async function handleEnablePush() {
    setPushBusy(true)
    setPushMessage(null)
    const result = await enablePush()
    setPushBusy(false)
    setPush(await getPushState())
    await load()
    if (!result.ok && result.reason) setPushMessage(result.reason)
  }

  async function handleDisablePush() {
    setPushBusy(true)
    await disablePush()
    setPushBusy(false)
    setPush(await getPushState())
    await load()
  }

  async function removeDevice(device: PushDevice) {
    setDevices((prev) => prev.filter((d) => d.id !== device.id))
    await fetch(`/api/notifications/push?endpoint=${encodeURIComponent(device.endpoint)}`, {method: 'DELETE'}).catch(() => {})
    setPush(await getPushState())
  }

  const anyExplicit = useMemo(
    () => Boolean(explicit && CHANNELS.some((c) => Object.keys(explicit[c]).length > 0)),
    [explicit],
  )

  if (!settings || !matrix || !explicit) {
    return (
      <div className="rounded-card border border-border bg-card px-6 py-16 text-center shadow-card">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Loading notification settings…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ global */}
      <section className="rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {settings.globalEnabled ? <Bell className="mt-1 h-4 w-4 text-gold" strokeWidth={1.75} /> : <BellOff className="mt-1 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
            <div>
              <h2 className="text-sm font-semibold text-primary">All notifications</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                The master switch. Security alerts remain recorded in your workspace even when muted elsewhere; every other signal is suppressed across all channels.
              </p>
            </div>
          </div>
          <Switch checked={settings.globalEnabled} onCheckedChange={toggleGlobal} disabled={busy} aria-label="Enable all notifications" />
        </div>

        <div className="grid gap-0 sm:grid-cols-2">
          <div className="flex items-start gap-3 border-b border-border px-6 py-5 sm:border-b sm:border-r">
            <Clock className="mt-1 h-4 w-4 text-gold/80" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-primary">Quiet hours</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Push notifications pause during this window (your local time). Security-critical alerts still come through.</p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="time"
                  value={quietFrom ?? ''}
                  onChange={(e) => void saveQuietHours(e.target.value || null, quietTo)}
                  className="rounded-standard border border-border bg-background px-2 py-1.5 text-xs text-primary focus:border-primary"
                  aria-label="Quiet hours start"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="time"
                  value={quietTo ?? ''}
                  onChange={(e) => void saveQuietHours(quietFrom, e.target.value || null)}
                  className="rounded-standard border border-border bg-background px-2 py-1.5 text-xs text-primary focus:border-primary"
                  aria-label="Quiet hours end"
                />
                {quietFrom && quietTo ? (
                  <button type="button" onClick={() => void saveQuietHours(null, null)} className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold">
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 border-b border-border px-6 py-5">
            <MonitorSmartphone className="mt-1 h-4 w-4 text-gold/80" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-primary">Email digest</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Fold lower-priority signals (opportunities, mandates, announcements) into one summary instead of individual emails.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Switch checked={settings.digestEnabled} onCheckedChange={toggleDigest} disabled={busy} aria-label="Enable digest" />
                {settings.digestEnabled ? (
                  <select
                    value={settings.digestFrequency}
                    onChange={(e) => void setFrequency(e.target.value as 'daily' | 'weekly')}
                    className="rounded-standard border border-border bg-background px-2 py-1.5 text-xs text-primary focus:border-primary"
                    aria-label="Digest frequency"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ matrix */}
      <section className="rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">Signals by channel</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Each category is controlled independently per channel. Dots mark your explicit overrides; everything else follows Murivest&apos;s high-signal defaults.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {savedAt ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-gold">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : null}
            {anyExplicit ? (
              <button
                type="button"
                onClick={() => {
                  setExplicit({in_app: {}, push: {}, email: {}})
                  void put({resetToDefaults: true})
                }}
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-gold"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Category</th>
                {CHANNELS.map((channel) => (
                  <th key={channel} className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {CHANNEL_LABELS[channel]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_CATEGORIES.map((category) => (
                <tr key={category} className={cn('border-b border-border last:border-b-0', category === 'security' && 'bg-gold/[0.03]')}>
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-medium text-primary">{CATEGORY_LABELS[category]}</div>
                    <div className="mt-0.5 max-w-xs text-[11px] leading-relaxed text-muted-foreground">{CATEGORY_HINTS[category]}</div>
                    {category === 'security' ? (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-[#9C3B2E]">
                        <ShieldAlert className="h-3 w-3" /> Recommended always on
                      </div>
                    ) : null}
                  </td>
                  {CHANNELS.map((channel) => {
                    const isExplicit = explicit[channel][category] !== undefined
                    return (
                      <td key={channel} className="px-4 py-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <Switch
                            checked={matrix[channel][category]}
                            onCheckedChange={(v) => void toggleCell(channel, category, v)}
                            disabled={busy}
                            aria-label={`${CHANNEL_LABELS[channel]} — ${CATEGORY_LABELS[category]}`}
                          />
                          {isExplicit ? <span className="h-1 w-1 rounded-full bg-gold" aria-label="Custom override" /> : <span className="h-1 w-1" />}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ push devices */}
      <section className="rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">Push notifications on your devices</h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Browser push works on desktop and installed mobile app — including when the portal is closed. OS-level notification permissions always take precedence.
            </p>
          </div>
          {push ? (
            push.subscribed ? (
              <button
                type="button"
                onClick={handleDisablePush}
                disabled={pushBusy}
                className="border border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
              >
                {pushBusy ? 'Working…' : 'Disable on this device'}
              </button>
            ) : push.supported && push.configured ? (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushBusy || push.permission === 'denied'}
                className="border border-forest bg-forest px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ivory transition-colors hover:bg-forest-deep disabled:opacity-50"
              >
                {pushBusy ? 'Requesting…' : push.permission === 'denied' ? 'Blocked in browser' : 'Enable on this device'}
              </button>
            ) : null
          ) : null}
        </div>

        {pushMessage ? (
          <div className="border-b border-border bg-gold/5 px-6 py-3 text-xs leading-relaxed text-primary">{pushMessage}</div>
        ) : null}
        {push?.permission === 'denied' ? (
          <div className="border-b border-border bg-gold/5 px-6 py-3 text-xs leading-relaxed text-primary">
            Notifications are blocked for this site in your browser settings. Re-enable them there, then return to this page.
          </div>
        ) : null}

        <div className="divide-y divide-border">
          {devices.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <MonitorSmartphone className="mx-auto mb-2 h-6 w-6 text-gold/40" strokeWidth={1.25} />
              <p className="text-xs leading-relaxed text-muted-foreground">
                No devices are subscribed yet. Enable push above, or from the bell menu at any time.
              </p>
            </div>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-primary">
                    {d.deviceLabel ?? (d.platform === 'mobile' ? 'Mobile device' : 'Desktop browser')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {d.platform === 'mobile' ? 'Installed app / mobile browser' : 'Desktop browser'} · active {relativeTime(d.lastSeenAt)} · added {relativeTime(d.createdAt)}
                  </div>
                </div>
                <button type="button" onClick={() => void removeDevice(d)} aria-label="Remove device" className="text-muted-foreground transition-colors hover:text-[#9C3B2E]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ install */}
      <section className="rounded-card border border-border bg-card shadow-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-primary">Install the portal as an app</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            On phone and desktop the portal installs as a standalone app (Add to Home Screen / install icon). Installed, it opens full-screen and its notifications reach the device even when the app is closed.
          </p>
        </div>
        <div className="divide-y divide-border">
          <InstallAppButton variant="full" />
        </div>
      </section>

      {/* ------------------------------------------------------------------ email */}
      <section className="rounded-card border border-border bg-card shadow-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-primary">Email delivery</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Transactional email is sent to <span className="font-medium text-primary">{email}</span> — one clear subject, one action, no marketing. Manage every category in the matrix above; the link in each email footer returns to this page.
          </p>
        </div>
        {settings.emailSuppressed ? (
          <div className="flex items-start gap-3 bg-gold/5 px-6 py-4">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#9C3B2E]" strokeWidth={1.75} />
            <p className="text-xs leading-relaxed text-primary">
              Email delivery is currently suspended after a delivery failure. Contact your advisor or{' '}
              <a href="mailto:office@murivest.com" className="font-medium text-gold hover:underline">
                office@murivest.com
              </a>{' '}
              so we can restore it.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
