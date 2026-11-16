import type {Metadata} from 'next'
import {supabase, unwrap, toCamelList, nowIso} from '@/lib/supabase'
import type {SecurityEventRow as SecurityEventDbRow, SessionRow as SessionDbRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import SecurityPanel, {type SessionRow, type SecurityEventRow} from '@/components/portal/SecurityPanel'

export const metadata: Metadata = {
  title: 'Account & Security',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function SecurityPage() {
  const ctx = await requirePortalUser()

  const [sessions, events] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', ctx.user.id)
      .is('revoked_at', null)
      .gt('expires_at', nowIso())
      .order('last_seen_at', {ascending: false})
      .then((res) => toCamelList(unwrap<SessionDbRow[]>(res, 'sessions.list'))),
    supabase
      .from('security_events')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', {ascending: false})
      .limit(50)
      .then((res) => toCamelList(unwrap<SecurityEventDbRow[]>(res, 'securityEvents.list'))),
  ])

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    device: s.device,
    ip: s.ip,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    expiresAt: s.expiresAt,
    current: s.id === ctx.session.id,
  }))

  const eventRows: SecurityEventRow[] = events.map((e) => ({
    id: e.id,
    type: e.type,
    ip: e.ip,
    userAgent: e.userAgent,
    createdAt: e.createdAt,
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Account integrity</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Account &amp; Security</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Password policy, TOTP two-factor authentication, device-recognised sessions with individual revocation, and a full security history — the controls expected of a private capital environment.
        </p>
      </div>
      <SecurityPanel mfaEnabled={ctx.user.mfaEnabled} sessions={sessionRows} events={eventRows} />
    </div>
  )
}
