import type {Metadata} from 'next'
import {db} from '@/lib/db'
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
    db.session.findMany({
      where: {userId: ctx.user.id, revokedAt: null, expiresAt: {gt: new Date()}},
      orderBy: {lastSeenAt: 'desc'},
    }),
    db.securityEvent.findMany({where: {userId: ctx.user.id}, orderBy: {createdAt: 'desc'}, take: 50}),
  ])

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    device: s.device,
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    current: s.id === ctx.session.id,
  }))

  const eventRows: SecurityEventRow[] = events.map((e) => ({
    id: e.id,
    type: e.type,
    ip: e.ip,
    userAgent: e.userAgent,
    createdAt: e.createdAt.toISOString(),
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
