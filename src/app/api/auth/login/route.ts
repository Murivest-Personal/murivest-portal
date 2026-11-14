import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {loginSchema} from '@/lib/validation'
import {verifyPassword} from '@/lib/auth/password'
import {createSession} from '@/lib/auth/login'
import {audit, securityEvent} from '@/lib/auth/audit'
import {parseBody, fail, clientMeta} from '@/lib/api'
import {challengeCookieValue} from '@/lib/auth/challenge'

const MAX_FAILED = 8
const LOCK_MINUTES = 15

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, loginSchema)
  if ('response' in parsed) return parsed.response
  const {email, password} = parsed.data
  const meta = clientMeta(req)

  const user = await db.user.findUnique({where: {email}, include: {profile: true}})
  if (!user || !user.passwordHash) {
    await securityEvent({type: 'login_failed', ...meta, detail: {email, reason: 'unknown_account'}})
    return fail('Invalid email or password.', 401)
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return fail('Account temporarily locked after repeated failed attempts. Try again shortly or reset your password.', 423)
  }
  if (user.status !== 'active') {
    return fail('This account is not active. Contact office@murivest.com.', 403)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    const failed = user.failedLogins + 1
    await db.user.update({
      where: {id: user.id},
      data: {
        failedLogins: failed,
        ...(failed >= MAX_FAILED ? {lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000)} : {}),
      },
    })
    await securityEvent({userId: user.id, type: 'login_failed', ...meta})
    if (failed >= MAX_FAILED) {
      await securityEvent({userId: user.id, type: 'account_locked', ...meta})
    }
    return fail('Invalid email or password.', 401)
  }

  // MFA: issue a short-lived challenge cookie; the session is created only
  // after the TOTP step succeeds.
  if (user.mfaEnabled) {
    const res = NextResponse.json({ok: true, mfaRequired: true})
    res.cookies.set('mvr_challenge', challengeCookieValue(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60,
    })
    return res
  }

  const {token} = await createSession(user.id, req)
  await audit({actorId: user.id, action: 'auth.login', entity: 'user', entityId: user.id, ...meta})

  const res = NextResponse.json({
    ok: true,
    next: user.profile && user.profile.onboardingStep >= 4 ? 'portal' : 'onboarding',
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
