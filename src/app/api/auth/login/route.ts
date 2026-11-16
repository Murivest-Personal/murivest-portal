import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable} from '@/lib/supabase'
import {loginSchema} from '@/lib/validation'
import {verifyPassword} from '@/lib/auth/password'
import {createSession} from '@/lib/auth/login'
import {audit, securityEvent} from '@/lib/auth/audit'
import {parseBody, fail, clientMeta} from '@/lib/api'
import {challengeCookieValue} from '@/lib/auth/challenge'
import type {InvestorProfileRow, UserRow} from '@/lib/db-types'

const MAX_FAILED = 8
const LOCK_MINUTES = 15

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, loginSchema)
  if ('response' in parsed) return parsed.response
  const {email, password} = parsed.data
  const meta = clientMeta(req)

  const userRow = unwrapNullable<UserRow>(
    await supabase.from('users').select('*').eq('email', email).maybeSingle(),
    'user.byEmail',
  )
  if (!userRow || !userRow.password_hash) {
    await securityEvent({type: 'login_failed', ...meta, detail: {email, reason: 'unknown_account'}})
    return fail('Invalid email or password.', 401)
  }
  if (userRow.locked_until && new Date(userRow.locked_until) > new Date()) {
    return fail('Account temporarily locked after repeated failed attempts. Try again shortly or reset your password.', 423)
  }
  if (userRow.status !== 'active') {
    return fail('This account is not active. Contact office@murivest.com.', 403)
  }

  const valid = await verifyPassword(password, userRow.password_hash)
  if (!valid) {
    const failed = userRow.failed_logins + 1
    unwrap<null>(
      await supabase
        .from('users')
        .update({
          failed_logins: failed,
          ...(failed >= MAX_FAILED
            ? {locked_until: new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()}
            : {}),
        })
        .eq('id', userRow.id),
      'user.recordFailedLogin',
    )
    await securityEvent({userId: userRow.id, type: 'login_failed', ...meta})
    if (failed >= MAX_FAILED) {
      await securityEvent({userId: userRow.id, type: 'account_locked', ...meta})
    }
    return fail('Invalid email or password.', 401)
  }

  // MFA: issue a short-lived challenge cookie; the session is created only
  // after the TOTP step succeeds.
  if (userRow.mfa_enabled) {
    const res = NextResponse.json({ok: true, mfaRequired: true})
    res.cookies.set('mvr_challenge', challengeCookieValue(userRow.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60,
    })
    return res
  }

  // NOTE: Prisma `include: {profile: true}` replaced by a follow-up query.
  const profileRow = unwrapNullable<InvestorProfileRow>(
    await supabase.from('investor_profiles').select('*').eq('user_id', userRow.id).maybeSingle(),
    'profile.byUser',
  )

  const {token} = await createSession(userRow.id, req)
  await audit({actorId: userRow.id, action: 'auth.login', entity: 'user', entityId: userRow.id, ...meta})

  const res = NextResponse.json({
    ok: true,
    next: profileRow && profileRow.onboarding_step >= 4 ? 'portal' : 'onboarding',
  })
  res.cookies.set('mvr_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })
  return res
}
