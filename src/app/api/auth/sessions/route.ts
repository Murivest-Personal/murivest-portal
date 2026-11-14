import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {revokeSession, revokeAllSessions} from '@/lib/auth/login'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {fail, clientMeta} from '@/lib/api'

const bodySchema = z.object({
  action: z.enum(['revoke', 'revoke_all']),
  sessionId: z.string().max(64).optional(),
})

/** GET — list active sessions for Account & Security. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const sessions = await db.session.findMany({
    where: {userId: ctx.user.id, revokedAt: null, expiresAt: {gt: new Date()}},
    orderBy: {lastSeenAt: 'desc'},
    select: {id: true, device: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true},
  })
  return NextResponse.json({
    ok: true,
    current: ctx.session.id,
    sessions: sessions.map((s) => ({...s, current: s.id === ctx.session.id})),
  })
}

/** POST — revoke one session or all others. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Invalid request.')
  const meta = clientMeta(req)

  if (parsed.data.action === 'revoke_all') {
    await revokeAllSessions(ctx.user.id, ctx.session.id)
    await audit({actorId: ctx.user.id, action: 'auth.sessions_revoked_all', ...meta})
    return NextResponse.json({ok: true})
  }
  if (parsed.data.action === 'revoke' && parsed.data.sessionId) {
    const target = await db.session.findFirst({where: {id: parsed.data.sessionId, userId: ctx.user.id}})
    if (!target) return fail('Session not found.', 404)
    await revokeSession(target.id)
    await audit({actorId: ctx.user.id, action: 'auth.session_revoked', entity: 'session', entityId: target.id, ...meta})
    return NextResponse.json({ok: true})
  }
  return fail('Unknown action.')
}
