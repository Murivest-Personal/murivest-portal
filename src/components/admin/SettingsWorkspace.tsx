'use client'

import {useCallback, useState} from 'react'
import {useRouter} from 'next/navigation'
import {Loader2, ShieldCheck, Download, UserPlus} from 'lucide-react'
import {fmtDateTime, relativeTime} from '@/lib/format'
import {adminAction, adminData, inputClass, labelClass} from './client'
import {SectionCard, StatusPill, DataTable, EmptyState, RolePill} from './ui'
import {cn} from '@/lib/utils'

export interface SettingsData {
  staff: {userId: string; email: string; fullName: string | null; role: string; adminRole: string; hasStaffProfile: boolean; title: string | null; team: string | null; isActive: boolean; status: string; lastLoginAt: string | null; mfaEnabled: boolean}[]
  settings: {id: string; key: string; category: string; value: unknown; description: string | null; updatedAt: string}[]
  integrationStatus: {key: string; label: string; configured: boolean; detail: string}[]
  can: {manage: boolean; staff: boolean; audit: boolean; security: boolean}
}

const KNOWN_FLAGS: {key: string; label: string; description: string}[] = [
  {key: 'flag.orders.custom_scope', label: 'Custom brief requests', description: 'Allow investors to request custom underwriting scopes in Orders.'},
  {key: 'flag.studio.capital_gap', label: 'Capital-gap analysis', description: 'Show financing-path suggestions when an opportunity exceeds stated equity.'},
  {key: 'flag.intelligence.teaser', label: 'Intelligence teaser on landing', description: 'Show a tier-gated Market Intelligence preview to anonymous visitors.'},
  {key: 'flag.notifications.email', label: 'Transactional email', description: 'Send order, verification and security notifications over SMTP.'},
]

export default function SettingsWorkspace({initial}: {initial: SettingsData}) {
  const router = useRouter()
  const {can} = initial
  const [tab, setTab] = useState<'staff' | 'flags' | 'integrations' | 'audit' | 'sessions'>(can.staff ? 'staff' : can.audit ? 'audit' : 'integrations')
  const [staff, setStaff] = useState(initial.staff)
  const [settings, setSettings] = useState(initial.settings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Create staff form
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [adminRole, setAdminRole] = useState('advisor')
  const [title, setTitle] = useState('')

  // Flag composer
  const [flagKey, setFlagKey] = useState('')
  const [flagEnabled, setFlagEnabled] = useState(true)

  // Audit viewer
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([])
  const [auditEntity, setAuditEntity] = useState('')
  const [auditAction, setAuditAction] = useState('')
  const [auditQ, setAuditQ] = useState('')
  const [auditLoaded, setAuditLoaded] = useState(false)

  // Sessions
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [securityEvents, setSecurityEvents] = useState<SecEvent[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  async function run(action: string, payload: Record<string, unknown>, okMessage: string) {
    setBusy(true)
    setError('')
    setMessage('')
    const res = await adminAction(action, payload)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Action failed.')
      return false
    }
    setMessage(okMessage)
    router.refresh()
    return true
  }

  const refreshStaff = useCallback(async () => {
    const res = await adminData<{staff: SettingsData['staff']}>('staff')
    if (res.ok && res.data) setStaff(res.data.staff)
  }, [])

  const loadAudit = useCallback(async () => {
    const res = await adminData<{logs: AuditRow[]}>('audit', {
      ...(auditEntity ? {entity: auditEntity} : {}),
      ...(auditAction ? {action: auditAction} : {}),
      ...(auditQ ? {q: auditQ} : {}),
    })
    if (res.ok && res.data) {
      setAuditLogs(res.data.logs)
      setAuditLoaded(true)
    }
  }, [auditEntity, auditAction, auditQ])

  const loadSessions = useCallback(async () => {
    const res = await adminData<{sessions: SessionRow[]; securityEvents: SecEvent[]}>('sessions')
    if (res.ok && res.data) {
      setSessions(res.data.sessions)
      setSecurityEvents(res.data.securityEvents)
      setSessionsLoaded(true)
    }
  }, [])

  const switchTab = (key: typeof tab) => {
    setTab(key)
    if (key === 'audit') void loadAudit()
    if (key === 'sessions') void loadSessions()
  }

  const flagValue = (key: string): boolean | null => {
    const s = settings.find((x) => x.key === key)
    if (!s) return null
    const v = (s.value ?? {}) as Record<string, unknown>
    return typeof v.enabled === 'boolean' ? v.enabled : null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 border-b border-border pb-2" role="tablist" aria-label="Settings sections">
        {([
          ['staff', 'Staff & roles', can.staff],
          ['flags', 'Feature flags', can.manage],
          ['integrations', 'Integrations', true],
          ['audit', 'Audit log', can.audit],
          ['sessions', 'Sessions & security', can.security],
        ] as const).filter(([, , ok]) => ok).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => switchTab(key)}
            className={cn('px-3 py-1.5 text-xs transition-colors', tab === key ? 'border-b-2 border-gold font-medium text-primary' : 'text-muted-foreground hover:text-primary')}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? <div className="border border-forest/30 bg-forest/10 px-3 py-2 text-xs text-forest">{message}</div> : null}
      {error ? <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}

      {tab === 'staff' ? (
        <>
          {can.staff ? (
            <SectionCard title="Create staff account" description="Role assignment is enforced server-side and at the database level">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor="staff-email">Email</label>
                  <input id="staff-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@murivest.com" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="staff-name">Full name</label>
                  <input id="staff-name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Wanjiru" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="staff-password">Temporary password</label>
                  <input id="staff-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="10+ chars, mixed case, number, symbol" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="staff-role">Admin role</label>
                  <select id="staff-role" className={inputClass} value={adminRole} onChange={(e) => setAdminRole(e.target.value)}>
                    {[
                      ['super_admin', 'Super Administrator'],
                      ['ops_lead', 'Operations Lead'],
                      ['advisor', 'Advisor / Relationship Manager'],
                      ['compliance', 'Compliance / KYC Officer'],
                      ['finance', 'Finance / Revenue'],
                      ['content', 'Content / Research'],
                      ['analyst', 'Read-Only Analyst'],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="staff-title">Title (optional)</label>
                  <input id="staff-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Advisor, Head of Research…" />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={busy || !email || !fullName || !password}
                    onClick={async () => {
                      const okRun = await run('staff.create', {email, fullName, password, adminRole, title}, 'Staff account created.')
                      if (okRun) {
                        setEmail('')
                        setFullName('')
                        setPassword('')
                        setTitle('')
                        await refreshStaff()
                      }
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 bg-primary px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Create account
                  </button>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Staff register" description={`${staff.length} staff accounts`}>
            <DataTable head={['Member', 'Admin role', 'Title / team', 'Status', 'Last login', can.staff ? 'Role management' : '']}>
              {staff.map((s) => (
                <tr key={s.userId}>
                  <td className="pl-0 pr-3 align-top">
                    <div className="text-xs font-medium text-primary">{s.fullName || s.email}</div>
                    <div className="text-[10px] text-muted-foreground">{s.email}{s.mfaEnabled ? ' · MFA on' : ''}</div>
                  </td>
                  <td className="px-3 align-top">
                    <RolePill role={s.adminRole} />
                    {!s.hasStaffProfile ? <div className="mt-1 text-[10px] text-muted-foreground">implicit ({s.role})</div> : null}
                  </td>
                  <td className="px-3 align-top text-xs">{s.title ?? '—'}{s.team ? ` · ${s.team}` : ''}</td>
                  <td className="px-3 align-top">
                    <StatusPill status={s.isActive && s.status === 'active' ? 'active' : s.status === 'suspended' ? 'suspended' : 'locked'} />
                  </td>
                  <td className="px-3 align-top text-xs text-muted-foreground">{s.lastLoginAt ? relativeTime(s.lastLoginAt) : 'never'}</td>
                  {can.staff ? (
                    <td className="px-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        <select
                          className="rounded-standard border border-border bg-background px-2 py-1 text-xs focus:border-primary"
                          value={s.adminRole}
                          onChange={async (e) => {
                            const okRun = await run('staff.update', {userId: s.userId, adminRole: e.target.value}, `Role updated to ${e.target.value}.`)
                            if (okRun) await refreshStaff()
                          }}
                          aria-label={`Role for ${s.email}`}
                        >
                          {['super_admin', 'ops_lead', 'advisor', 'compliance', 'finance', 'content', 'analyst'].map((r) => (
                            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const okRun = await run('staff.update', {userId: s.userId, isActive: !s.isActive}, s.isActive ? 'Staff deactivated — sessions revoked.' : 'Staff reactivated.')
                            if (okRun) await refreshStaff()
                          }}
                          className="border border-border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-primary disabled:opacity-60"
                        >
                          {s.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </DataTable>
          </SectionCard>
        </>
      ) : null}

      {tab === 'flags' ? (
        <>
          <SectionCard title="Feature flags" description="Runtime switches — read by the portal; changes are audit-logged">
            <ul className="space-y-3">
              {KNOWN_FLAGS.map((f) => {
                const enabled = flagValue(f.key)
                return (
                  <li key={f.key} className="flex flex-col gap-2 border border-border p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-primary">{f.label}</div>
                      <div className="text-[10px] text-muted-foreground">{f.key} · {f.description}</div>
                    </div>
                    {can.manage ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run('setting.upsert', {key: f.key, category: 'feature_flag', description: f.label, value: {enabled: !(enabled ?? false)}}, `${f.label} ${enabled ?? false ? 'disabled' : 'enabled'}.`)}
                        className={cn('inline-flex items-center gap-2 whitespace-nowrap border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] disabled:opacity-60', enabled ?? false ? 'border-forest/40 bg-forest/10 text-primary' : 'border-border text-muted-foreground')}
                      >
                        <ShieldCheck className="h-3 w-3" /> {enabled ?? false ? 'Enabled' : enabled === null ? 'Not set (off)' : 'Disabled'}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{enabled ?? false ? 'Enabled' : 'Off'}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          {can.manage ? (
            <SectionCard title="Configuration values" description="Fee schedules and finance parameters (JSON values)">
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-64 flex-1">
                    <label className={labelClass} htmlFor="flag-key">Key</label>
                    <input id="flag-key" className={inputClass} value={flagKey} onChange={(e) => setFlagKey(e.target.value)} placeholder="payments.fee_schedule" />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !flagKey}
                    onClick={async () => {
                      const okRun = await run('setting.upsert', {key: flagKey, category: 'general', value: {enabled: flagEnabled}}, 'Setting saved.')
                      if (okRun) {
                        setFlagKey('')
                        const res = await adminData<{settings: SettingsData['settings']}>('settings')
                        if (res.ok && res.data) setSettings(res.data.settings)
                      }
                    }}
                    className="bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60"
                  >
                    Save {flagEnabled ? 'enabled' : 'disabled'}
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={flagEnabled} onChange={(e) => setFlagEnabled(e.target.checked)} className="accent-forest" /> enabled
                  </label>
                </div>
                {settings.length > 0 ? (
                  <DataTable head={['Key', 'Category', 'Value', 'Updated']}>
                    {settings.map((s) => (
                      <tr key={s.id}>
                        <td className="pl-0 pr-3 text-xs font-medium text-primary">{s.key}</td>
                        <td className="px-3 text-xs text-muted-foreground">{s.category.replace(/_/g, ' ')}</td>
                        <td className="px-3 text-xs"><code className="bg-secondary/60 px-1.5 py-0.5 text-[10px]">{JSON.stringify(s.value)}</code></td>
                        <td className="px-3 text-xs text-muted-foreground">{relativeTime(s.updatedAt)}</td>
                      </tr>
                    ))}
                  </DataTable>
                ) : null}
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Example — card processing at 2.9%: set key <code className="bg-secondary/60 px-1">payments.fee_schedule</code> to
                  <code className="ml-1 bg-secondary/60 px-1">{`{"card":2.9,"mpesa":0,"wire":0}`}</code>. Secrets are never stored here — they live in environment variables (SMTP credentials, Sanity tokens, payment keys).
                </p>
              </div>
            </SectionCard>
          ) : null}
        </>
      ) : null}

      {tab === 'integrations' ? (
        <SectionCard title="Integration status" description="Secrets remain environment variables — never stored in the database">
          <ul className="grid gap-3 sm:grid-cols-2">
            {initial.integrationStatus.map((i) => (
              <li key={i.key} className="border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-primary">{i.label}</span>
                  <StatusPill status={i.configured ? 'verified' : 'pending'} label={i.configured ? 'Connected' : 'Not configured'} />
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground">{i.detail}</div>
              </li>
            ))}
            <li className="border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-primary">Auctions — auctions.murivest.com</span>
                <StatusPill status="verified" label="Linked" />
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">Auction inventory is surfaced in Discover and orderable as auction-sourced briefs.</div>
            </li>
          </ul>
          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
            SMTP uses your own credentials via SMTP_HOST / SMTP_USER / SMTP_PASS environment variables (nodemailer — not a third-party email SaaS). Sanity content is read server-side only; the read token never reaches the browser.
          </p>
        </SectionCard>
      ) : null}

      {tab === 'audit' ? (
        <SectionCard
          title="Audit log viewer"
          description="Every sensitive action across portal and admin — immutable"
          actions={
            <a href="/api/admin/export?dataset=audit" className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
              <Download className="h-3 w-3" /> CSV
            </a>
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <input className={inputClass} placeholder="Entity (order, payment, profile…)" value={auditEntity} onChange={(e) => setAuditEntity(e.target.value)} aria-label="Filter entity" />
            <input className={inputClass} placeholder="Action contains (e.g. admin.)" value={auditAction} onChange={(e) => setAuditAction(e.target.value)} aria-label="Filter action" />
            <div className="flex gap-2">
              <input className={inputClass} placeholder="Search detail / id" value={auditQ} onChange={(e) => setAuditQ(e.target.value)} aria-label="Search audit" />
              <button type="button" onClick={() => void loadAudit()} className="whitespace-nowrap bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground">
                Apply
              </button>
            </div>
          </div>
          {!auditLoaded ? (
            <EmptyState title="Press Apply to load the audit log" description="The viewer loads on demand to keep this screen fast." action={<button type="button" onClick={() => void loadAudit()} className="border border-gold/40 bg-gold/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">Load audit log</button>} />
          ) : auditLogs.length === 0 ? (
            <EmptyState title="No matching entries" />
          ) : (
            <DataTable head={['When', 'Actor', 'Action', 'Entity', 'IP']} dense>
              {auditLogs.map((l) => (
                <tr key={l.id}>
                  <td className="pl-0 pr-3 whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-3 text-xs">{l.actorName ?? l.actorType}</td>
                  <td className="px-3 text-xs font-medium text-primary">{l.action}</td>
                  <td className="px-3 text-xs text-muted-foreground">{l.entity ?? '—'}{l.entityId ? ` · ${l.entityId.slice(0, 14)}` : ''}</td>
                  <td className="px-3 text-xs text-muted-foreground">{l.ip ?? '—'}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </SectionCard>
      ) : null}

      {tab === 'sessions' ? (
        <>
          <SectionCard title="Active sessions" description="All signed-in users — revoke immediately on suspicion">
            {!sessionsLoaded ? (
              <EmptyState title="Sessions load on demand" action={<button type="button" onClick={() => void loadSessions()} className="border border-gold/40 bg-gold/10 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">Load sessions</button>} />
            ) : sessions.length === 0 ? (
              <EmptyState title="No sessions found" />
            ) : (
              <DataTable head={['User', 'Device', 'IP', 'Last seen', 'Expires', can.security ? '' : '']} dense>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="pl-0 pr-3 text-xs font-medium text-primary">{s.userName} <span className="text-[10px] text-muted-foreground">({s.userRole})</span></td>
                    <td className="px-3 text-xs">{s.device ?? '—'}</td>
                    <td className="px-3 text-xs text-muted-foreground">{s.ip ?? '—'}</td>
                    <td className="px-3 text-xs text-muted-foreground">{relativeTime(s.lastSeenAt)}</td>
                    <td className="px-3 text-xs text-muted-foreground">{fmtDateTime(s.expiresAt)}</td>
                    {can.security ? (
                      <td className="px-3 text-xs">
                        {s.revokedAt ? (
                          <span className="text-[10px] uppercase tracking-[0.1em] text-destructive">revoked</span>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => run('session.revoke', {sessionId: s.id}, 'Session revoked.')} className="border border-destructive/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-destructive disabled:opacity-60">
                            Revoke
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </DataTable>
            )}
          </SectionCard>

          <SectionCard title="Security events" description="Recent authentication and account events">
            {!sessionsLoaded ? (
              <p className="text-xs text-muted-foreground">Load sessions above to view security events.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {securityEvents.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="text-primary">
                      <StatusPill status={e.type.includes('failed') ? 'rejected' : e.type.includes('locked') ? 'flagged' : 'in_review'} label={e.type.replace(/_/g, ' ')} />
                      <span className="ml-2 text-muted-foreground">{e.userEmail ?? 'unknown user'}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">{relativeTime(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}

interface AuditRow {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  actorType: string
  actorName: string | null
  ip: string | null
  createdAt: string
}

interface SessionRow {
  id: string
  userName: string
  userRole: string
  device: string | null
  ip: string | null
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  revokedAt: string | null
}

interface SecEvent {
  id: string
  type: string
  userEmail: string | null
  ip: string | null
  createdAt: string
}
