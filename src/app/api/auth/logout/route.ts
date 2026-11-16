import {NextResponse, type NextRequest} from 'next/server'
import {revokeSession} from '@/lib/auth/login'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {clientMeta} from '@/lib/api'

export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  await revokeSession(ctx.session.id)
  await audit({actorId: ctx.user.id, action: 'auth.logout', ...clientMeta(req)})
  const res = NextResponse.json({ok: true})
  res.cookies.delete('mvr_session')
  return res
}

export const dynamic = 'force-dynamic'
