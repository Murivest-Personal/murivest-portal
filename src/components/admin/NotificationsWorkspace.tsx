'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  Activity,
  Megaphone,
  Mail,
  MonitorSmartphone,
  Send,
  ShieldAlert,
  RotateCcw,
  Save,
  FileText,
  Ban,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import {relativeTime} from '@/lib/format'
import {PageHeader, SectionCard, MetricTile, EmptyState, StatusPill, DataTable} from '@/components/admin/ui'
import {inputClass, labelClass} from '@/components/admin/client'

/**
 * Admin Notification Operations (spec §8):
 *   Ledger    — every channel delivery with status, bounce/failure rates and
 *               per-row overrides (redeliver email, suppress pending).
 *   Announcements — controlled one-off broadcasts to segments, fully audited.
 *   Templates — transactional email template manager with version history.
 *
 * Advisors are scoped to their assigned investors by the API.
 */

interface Stats {
  byChannel: Record<string, Record<string, number>>
  totals: {
    deliveries: number
    emailSent: number
    emailFailed: number
    emailBounceRate: number
    digestQueued: number
    announcements: number
    pushSubscriptions: number
    emailSuppressedInvestors: number
  }
  period: {from: string; label: string}
}

interface LogRow {
  id: string
  notificationId: string
  channel: string
  status: string
  address: string | null
  detail: string | null
  sentAt: string | null
  createdAt: string
  userId: string
  notification: {id: string; title: string; category: string; event: string | null; priority: string; link: string | null}
  investor: {email: string; name: string | null} | null
}

interface AnnouncementRow {
  id: string
  title: string
  body: string
  link: string | null
  category: string
  priority: string
  audience: Record<string, unknown>
  recipientCount: number
  sentAt: string | null
  createdAt: string
  createdBy: string | null
}

interface TemplateRow {
  key: string
  category: string
  overridden: boolean
  isActive: boolean
  version: number
  updatedAt: string | null
  subject: string
  preheader: string
  bodyHtml: string
  bodyText: string
  placeholders: string[]
}

interface VersionRow {
  id: string
  version: number
  subject: string
  createdAt: string
  savedById: string | null
  template: {key: string}
}

const STATUS_TONE: Record<string, string> = {
  sent: 'text-forest',
  failed: 'text-[#9C3B2E]',
  bounced: 'text-[#9C3B2E]',
  suppressed: 'text-muted-foreground',
  skipped: 'text-muted-foreground',
  queued: 'text-gold',
  digest_queued: 'text-gold',
}

async function notifyGet(scope: string, params: Record<string, string> = {}): Promise<{ok: boolean; error?: string; data?: Record<string, unknown>}> {
  const qs = new URLSearchParams({scope, ...params}).toString()
  const res = await fetch(`/api/admin/notifications?${qs}`, {cache: 'no-store'})
  const data = await res.json().catch(() => ({ok: false, error: 'Unexpected response.'}))
  if (!res.ok) return {ok: false, error: (data as {error?: string}).error ?? `Request failed (${res.status}).`}
  return {ok: true, data: data as Record<string, unknown>}
}

async function notifyPost(action: string, payload: Record<string, unknown> = {}) {
  try {
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action, payload}),
    })
    const data = await res.json().catch(() => ({ok: false, error: 'Unexpected response.'}))
    if (!res.ok) return {ok: false as const, error: (data as {error?: string}).error ?? `Request failed (${res.status}).`}
    return {ok: true as const, ...(data as Record<string, unknown>)}
  } catch {
    return {ok: false as const, error: 'Network error — please retry.'}
  }
}

export default function NotificationsWorkspace({canManage, canBroadcast}: {canManage: boolean; canBroadcast: boolean}) {
  const [tab, setTab] = useState<'ledger' | 'announcements' | 'templates'>('ledger')
  const [stats, setStats] = useState<Stats | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [channelFilter, setChannelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Announcement composer
  const [aTitle, setATitle] = useState('')
  const [aBody, setABody] = useState('')
  const [aLink, setALink] = useState('')
  const [aAudience, setAAudience] = useState('all')
  const [aBusy, setABusy] = useState(false)

  // Template editor
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editPreheader, setEditPreheader] = useState('')
  const [editHtml, setEditHtml] = useState('')
  const [editText, setEditText] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [tBusy, setTBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const logParams: Record<string, string> = {}
    if (channelFilter) logParams.channel = channelFilter
    if (statusFilter) logParams.status = statusFilter
    const [s, l, a, t] = await Promise.all([
      notifyGet('stats'),
      notifyGet('log', logParams),
      notifyGet('announcements'),
      notifyGet('templates'),
    ])
    if (s.ok && s.data) setStats(s.data as unknown as Stats)
    else setError(s.error ?? null)
    if (l.ok && l.data) setLog((l.data.log as LogRow[]) ?? [])
    if (a.ok && a.data) setAnnouncements((a.data.announcements as AnnouncementRow[]) ?? [])
    if (t.ok && t.data) {
      setTemplates((t.data.templates as TemplateRow[]) ?? [])
      setVersions((t.data.versions as VersionRow[]) ?? [])
    }
  }, [channelFilter, statusFilter])

  useEffect(() => {
    // Initial load deferred to a task so setState never runs synchronously
    // inside the effect body (react-hooks/set-state-in-effect).
    const initial = setTimeout(() => void load(), 0)
    return () => clearTimeout(initial)
  }, [load])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  async function redeliver(row: LogRow) {
    const res = await notifyPost('notification.redeliver', {notificationId: row.notificationId})
    setNotice(res.ok ? 'Email redelivery attempted.' : res.error)
    if (res.ok) void load()
  }

  async function suppress(row: LogRow) {
    const res = await notifyPost('notification.suppress', {notificationId: row.notificationId})
    setNotice(res.ok ? 'Pending deliveries suppressed.' : res.error)
    if (res.ok) void load()
  }

  async function unsuppress(userId: string) {
    const res = await notifyPost('investor.emailUnsuppress', {userId})
    setNotice(res.ok ? 'Email delivery restored for this investor.' : res.error)
  }

  async function sendAnnouncement() {
    if (!aTitle.trim() || !aBody.trim()) return
    setABusy(true)
    const audience: Record<string, unknown> =
      aAudience === 'verified' ? {verifiedOnly: true} : aAudience.startsWith('tier_') ? {tiers: [aAudience]} : {}
    const res = await notifyPost('announcement.send', {title: aTitle, body: aBody, link: aLink || '/portal', category: 'system', priority: 'high', audience})
    setABusy(false)
    if (res.ok) {
      setATitle('')
      setABody('')
      setALink('')
      setNotice(`Announcement queued to ${(res as unknown as {recipients: number}).recipients} investor(s).`)
      void load()
    } else {
      setError(res.error)
    }
  }

  function openTemplate(t: TemplateRow) {
    setEditKey(t.key)
    setEditSubject(t.subject)
    setEditPreheader(t.preheader)
    setEditHtml(t.bodyHtml)
    setEditText(t.bodyText)
    setEditActive(t.isActive)
  }

  async function saveTemplate() {
    if (!editKey) return
    setTBusy(true)
    const res = await notifyPost('template.save', {
      key: editKey,
      subject: editSubject,
      preheader: editPreheader,
      bodyHtml: editHtml,
      bodyText: editText,
      isActive: editActive,
    })
    setTBusy(false)
    if (res.ok) {
      setNotice(`Template saved (v${(res as unknown as {version: number}).version}).`)
      setEditKey(null)
      void load()
    } else {
      setError(res.error)
    }
  }

  async function resetTemplate(key: string) {
    const res = await notifyPost('template.reset', {key})
    if (res.ok) {
      setNotice('Template reset to the platform default.')
      void load()
    } else {
      setError(res.error)
    }
  }

  const editing = useMemo(() => templates.find((t) => t.key === editKey) ?? null, [templates, editKey])

  return (
    <div>
      <PageHeader
        eyebrow="Notification operations"
        title="Notifications"
        description="Multi-channel delivery ledger, controlled announcements and transactional email templates — every send is recorded and auditable."
      />

      {error ? (
        <div className="mb-4 flex items-center gap-2 border border-[#9C3B2E]/30 bg-[#9C3B2E]/5 px-4 py-3 text-xs text-primary">
          <ShieldAlert className="h-4 w-4 text-[#9C3B2E]" /> {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 flex items-center gap-2 border border-gold/30 bg-gold/5 px-4 py-3 text-xs text-primary">
          <CheckCircle2 className="h-4 w-4 text-gold" /> {notice}
        </div>
      ) : null}

      {stats ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Deliveries (30 days)" value={stats.totals.deliveries.toLocaleString('en-GB')} icon={<Activity className="h-3.5 w-3.5 text-gold" />} />
          <MetricTile label="Email sent" value={stats.totals.emailSent.toLocaleString('en-GB')} icon={<Mail className="h-3.5 w-3.5 text-gold" />} />
          <MetricTile label="Email failure / bounce" value={`${stats.totals.emailFailed.toLocaleString('en-GB')} · ${stats.totals.emailBounceRate}%`} icon={<ShieldAlert className="h-3.5 w-3.5 text-[#9C3B2E]" />} />
          <MetricTile label="Active push devices" value={stats.totals.pushSubscriptions.toLocaleString('en-GB')} icon={<MonitorSmartphone className="h-3.5 w-3.5 text-gold" />} />
        </div>
      ) : null}

      <div className="mb-5 flex border-b border-border">
        {([
          ['ledger', 'Delivery ledger'],
          ['announcements', 'Announcements'],
          ['templates', 'Email templates'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] transition-colors',
              tab === key ? 'border-b-2 border-gold font-semibold text-primary' : 'text-muted-foreground hover:text-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ledger' ? (
        <SectionCard
          title="Delivery ledger"
          description="Every in-app, push and email delivery attempt — who was told what, when, and with what outcome."
          actions={
            <div className="flex items-center gap-2">
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="border border-border bg-background px-2 py-1.5 text-xs text-primary focus:border-gold focus:outline-none" aria-label="Filter channel">
                <option value="">All channels</option>
                <option value="in_app">In-app</option>
                <option value="push">Push</option>
                <option value="email">Email</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-border bg-background px-2 py-1.5 text-xs text-primary focus:border-gold focus:outline-none" aria-label="Filter status">
                <option value="">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="bounced">Bounced</option>
                <option value="suppressed">Suppressed</option>
                <option value="skipped">Skipped</option>
                <option value="digest_queued">Digest queued</option>
              </select>
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
          }
        >
          {log.length === 0 ? (
            <EmptyState title="No deliveries recorded yet" description="As soon as material events fire — orders, documents, messages, security — the per-channel delivery ledger appears here." />
          ) : (
            <DataTable head={['When', 'Investor', 'Notification', 'Channel', 'Status', 'Address', canManage ? 'Actions' : '']}>
              {log.slice(0, 40).map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(row.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-primary">{row.investor?.name || '—'}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{row.investor?.email || '—'}</div>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-xs">
                    <div className="truncate font-medium text-primary">{row.notification.title}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      {row.notification.category} {row.notification.event ? `· ${row.notification.event}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-[0.1em] text-muted-foreground">{row.channel.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-semibold uppercase tracking-[0.12em]', STATUS_TONE[row.status] ?? 'text-muted-foreground')}>{row.status.replace('_', ' ')}</span>
                    {row.detail ? <div className="mt-0.5 max-w-[12rem] truncate text-[10px] text-muted-foreground" title={row.detail}>{row.detail}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.address ?? '—'}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {row.channel === 'email' && ['failed', 'bounced'].includes(row.status) ? (
                          <button type="button" onClick={() => void redeliver(row)} className="text-[10px] uppercase tracking-[0.12em] text-gold hover:underline">
                            Redeliver
                          </button>
                        ) : null}
                        {row.status === 'digest_queued' ? (
                          <button type="button" onClick={() => void suppress(row)} className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-[#9C3B2E]">
                            Suppress
                          </button>
                        ) : null}
                        {row.status === 'bounced' ? (
                          <button type="button" onClick={() => void unsuppress(row.userId)} className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-gold">
                            Restore email
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </DataTable>
          )}
          {stats && stats.totals.emailSuppressedInvestors > 0 ? (
            <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <Ban className="h-3.5 w-3.5 text-[#9C3B2E]" />
              {stats.totals.emailSuppressedInvestors} investor(s) have email hard-suppressed after bounces — clear from a bounced row above once the address is corrected.
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {tab === 'announcements' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {canBroadcast ? (
            <SectionCard title="New announcement" description="Rare, high-signal broadcasts to a selected segment. Every recipient, channel and delivery is recorded.">
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="a-title">Title</label>
                  <input id="a-title" className={inputClass} value={aTitle} onChange={(e) => setATitle(e.target.value)} maxLength={120} placeholder="e.g. Scheduled maintenance window" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="a-body">Message</label>
                  <textarea id="a-body" className={`${inputClass} min-h-[96px]`} value={aBody} onChange={(e) => setABody(e.target.value)} maxLength={600} placeholder="One or two precise sentences — institutional tone, no marketing." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="a-audience">Audience</label>
                    <select id="a-audience" className={inputClass} value={aAudience} onChange={(e) => setAAudience(e.target.value)}>
                      <option value="all">All active investors</option>
                      <option value="verified">Verified investors</option>
                      <option value="tier_2">Tier 2 investors</option>
                      <option value="tier_3">Tier 3 investors</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="a-link">Deep link (optional)</label>
                    <input id="a-link" className={inputClass} value={aLink} onChange={(e) => setALink(e.target.value)} placeholder="/portal" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void sendAnnouncement()}
                  disabled={aBusy || !aTitle.trim() || !aBody.trim()}
                  className="inline-flex items-center gap-2 border border-forest bg-forest px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory transition-colors hover:bg-forest-deep disabled:opacity-50"
                >
                  {aBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send announcement
                </button>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="New announcement" description="Broadcasting is restricted to Operations Leads and Super Administrators.">
              <EmptyState title="Permission required" description="You do not hold the broadcast.send permission. Contact a Super Administrator if a controlled announcement is needed." />
            </SectionCard>
          )}

          <SectionCard title="Announcement history" description="Audited record of every broadcast — audience, recipients and timestamp.">
            {announcements.length === 0 ? (
              <EmptyState title="No announcements sent" description="Broadcasts are reserved for rare, genuinely material platform notices." />
            ) : (
              <ul className="divide-y divide-border">
                {announcements.map((a) => (
                  <li key={a.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Megaphone className="h-3.5 w-3.5 flex-shrink-0 text-gold" />
                          <span className="truncate text-sm font-medium text-primary">{a.title}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{a.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span>{a.recipientCount} recipients</span>
                          <span>{a.sentAt ? relativeTime(a.sentAt) : 'queued'}</span>
                          <span>{a.createdBy ?? '—'}</span>
                          <StatusPill status={a.category} />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : null}

      {tab === 'templates' ? (
        <div className="space-y-6">
          <SectionCard title="Transactional email templates" description="Active overrides replace the platform defaults per key; every edit is versioned and attributable. Placeholders use {{token}} syntax.">
            {templates.length === 0 ? (
              <EmptyState title="No templates loaded" />
            ) : (
              <DataTable head={['Key', 'Category', 'Subject', 'State', canManage ? 'Actions' : '']}>
                {templates.map((t) => (
                  <tr key={t.key} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-xs font-medium text-primary">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-gold/70" /> {t.key}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase tracking-[0.1em] text-muted-foreground">{t.category}</td>
                    <td className="max-w-[18rem] truncate px-4 py-3 text-xs text-muted-foreground">{t.subject}</td>
                    <td className="px-4 py-3 text-xs">
                      {t.overridden ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">Override · v{t.version}{t.isActive ? '' : ' · off'}</span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Default</span>
                      )}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => openTemplate(t)} className="text-[10px] uppercase tracking-[0.12em] text-gold hover:underline">
                            Edit
                          </button>
                          {t.overridden ? (
                            <button type="button" onClick={() => void resetTemplate(t.key)} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary">
                              <RotateCcw className="h-3 w-3" /> Reset
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>

          {versions.length > 0 ? (
            <SectionCard title="Version history" description="Immutable audit trail of template edits.">
              <DataTable head={['Template', 'Version', 'Subject', 'Saved']}>
                {versions.slice(0, 15).map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-xs font-medium text-primary">{v.template.key}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">v{v.version}</td>
                    <td className="max-w-[18rem] truncate px-4 py-3 text-xs text-muted-foreground">{v.subject}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(v.createdAt)}</td>
                  </tr>
                ))}
              </DataTable>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {/* Template editor modal */}
      {editKey && editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button type="button" aria-label="Close editor" onClick={() => setEditKey(null)} className="absolute inset-0 bg-forest-deep/70 backdrop-blur-sm" />
          <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Email template</div>
                <div className="font-display text-lg text-primary">{editKey}</div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="h-3.5 w-3.5 accent-[#1B4332]" /> Active
                </label>
                <button type="button" onClick={() => void saveTemplate()} disabled={tBusy} className="inline-flex items-center gap-2 border border-forest bg-forest px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ivory hover:bg-forest-deep disabled:opacity-50">
                  {tBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save version
                </button>
              </div>
            </div>
            <div className="portal-scroll flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="rounded-sm border border-gold/30 bg-gold/5 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                Available placeholders: {editing.placeholders.map((p) => `{{${p}}}`).join('  ')}
              </div>
              <div>
                <label className={labelClass} htmlFor="t-subject">Subject line</label>
                <input id="t-subject" className={inputClass} value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="t-preheader">Preheader</label>
                <input id="t-preheader" className={inputClass} value={editPreheader} onChange={(e) => setEditPreheader(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="t-html">HTML body (table-based, inline styles — email-client safe)</label>
                <textarea id="t-html" className={`${inputClass} min-h-[220px] font-mono text-xs`} value={editHtml} onChange={(e) => setEditHtml(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="t-text">Plain-text body</label>
                <textarea id="t-text" className={`${inputClass} min-h-[140px] font-mono text-xs`} value={editText} onChange={(e) => setEditText(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
