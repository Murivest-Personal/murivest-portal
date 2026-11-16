import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, toCamelList, nowIso} from '@/lib/supabase'
import {revokeSession, revokeAllSessions} from '@/lib/auth/login'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {fail, clientMeta} from '@/lib/api'
import type {SessionRow} from '@/lib/db-types'

/** Column subset for the Account & Security session list (snake_case, DB shape). */
type SessionListRow = Pick<
  SessionRow,
  'id' | 'device' | 'ip' | 'user_agent' | 'created_at' | 'last_seen_at' | 'expires_at'
>

const bodySchema = z.object({
  action: z.enum(['revoke', 'revoke_all']),
  sessionId: z.string().max(64).optional(),
})

/** GET — list active sessions for Account & Security. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const sessions = toCamelList(
    unwrap<SessionListRow[]>(
      await supabase
        .from('sessions')
        .select('id, device, ip, user_agent, created_at, last_seen_at, expires_at')
        .eq('user_id', ctx.user.id)
        .is('revoked_at', null)
        .gt('expires_at', nowIso())
        .order('last_seen_at', {ascending: false}),
      'sessions.list',
    ),
  )
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
    const target = unwrapNullable<SessionRow>(
      await supabase
        .from('sessions')
        .select('*')
        .eq('id', parsed.data.sessionId)
        .eq('user_id', ctx.user.id)
        .maybeSingle(),
      'session.byId',
    )
    if (!target) return fail('Session not found.', 404)
    await revokeSession(target.id)
    await audit({actorId: ctx.user.id, action: 'auth.session_revoked', entity: 'session', entityId: target.id, ...meta})
    return NextResponse.json({ok: true})
  }
  return fail('Unknown action.')
}
