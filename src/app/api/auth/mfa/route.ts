import {NextResponse, type NextRequest} from 'next/server'
import {cookies} from 'next/headers'
import {z} from 'zod'
import QRCode from 'qrcode'
import {db} from '@/lib/db'
import {totpSchema} from '@/lib/validation'
import {generateTotpSecret, verifyTotp, encryptSecret, decryptSecret} from '@/lib/auth/totp'
import {verifyChallengeCookie, MFA_CHALLENGE_COOKIE} from '@/lib/auth/challenge'
import {createSession} from '@/lib/auth/login'
import {audit, securityEvent, notify} from '@/lib/auth/audit'
import {verifyPassword} from '@/lib/auth/password'
import {parseBody, fail, clientMeta} from '@/lib/api'
import {requireApiUser, isResponse} from '@/lib/auth/context'

/**
 * MFA actions:
 *   POST {action: 'setup'}          → returns QR + otpauth (auth required)
 *   POST {action: 'enable', code}   → verifies code, stores encrypted secret
 *   POST {action: 'disable', code, password}
 *   POST {action: 'challenge', code} → completes login when challenge cookie set
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const action = (body as {action?: string} | null)?.action
  const meta = clientMeta(req)

  // --- Challenge: complete login after password step -----------------------
  if (action === 'challenge') {
    const jar = await cookies()
    const userId = verifyChallengeCookie(jar.get(MFA_CHALLENGE_COOKIE)?.value)
    if (!userId) return fail('Your sign-in challenge expired. Sign in again.', 401)
    const parsed = totpSchema.safeParse(body)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Enter the 6-digit code.')
    const user = await db.user.findUnique({where: {id: userId}})
    if (!user?.mfaEnabled || !user.mfaSecretEnc) return fail('MFA is not enabled on this account.', 400)
    const secret = decryptSecret(user.mfaSecretEnc)
    if (!secret || !verifyTotp(secret, parsed.data.code)) {
      await securityEvent({userId, type: 'login_failed', ...meta, detail: {stage: 'mfa'}})
      return fail('Invalid authentication code.', 401)
    }
    const {token} = await createSession(userId, req)
    await audit({actorId: userId, action: 'auth.login.mfa', entity: 'user', entityId: userId, ...meta})
    const profile = await db.investorProfile.findUnique({where: {userId}})
    const res = NextResponse.json({ok: true, next: profile && profile.onboardingStep >= 4 ? 'portal' : 'onboarding'})
    res.cookies.set('mvr_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
    res.cookies.delete(MFA_CHALLENGE_COOKIE)
    return res
  }

  // --- All other actions require an authenticated session ------------------
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard

  if (action === 'setup') {
    if (ctx.user.mfaEnabled) return fail('MFA is already enabled.')
    const {secret, otpauthUrl} = generateTotpSecret()
    const qr = await QRCode.toDataURL(otpauthUrl(ctx.user.email), {margin: 1, width: 220, color: {dark: '#0E2A1C', light: '#FFFFFF'}})
    // stash the candidate secret (encrypted) pending confirmation
    await db.user.update({where: {id: ctx.user.id}, data: {mfaSecretEnc: encryptSecret(secret), mfaEnabled: false}})
    return NextResponse.json({ok: true, qr, otpauth: otpauthUrl(ctx.user.email), secret})
  }

  if (action === 'enable') {
    const parsed = totpSchema.safeParse(body)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || 'Enter the 6-digit code.')
    if (!ctx.user.mfaSecretEnc) return fail('Start MFA setup first.')
    const secret = decryptSecret(ctx.user.mfaSecretEnc)
    if (!secret || !verifyTotp(secret, parsed.data.code)) return fail('That code did not match. Try the next one.')
    await db.user.update({where: {id: ctx.user.id}, data: {mfaEnabled: true}})
    await securityEvent({userId: ctx.user.id, type: 'mfa_enabled', ...meta})
    await audit({actorId: ctx.user.id, action: 'auth.mfa_enabled', ...meta})
    return NextResponse.json({ok: true})
  }

  if (action === 'disable') {
    const parsed = z.object({code: z.string().regex(/^\d{6}$/), password: z.string().min(1)}).safeParse(body)
    if (!parsed.success) return fail('Provide your password and a current code.')
    const valid = await verifyPassword(parsed.data.password, ctx.user.passwordHash)
    if (!valid) return fail('Password incorrect.', 401)
    if (ctx.user.mfaEnabled && ctx.user.mfaSecretEnc) {
      const secret = decryptSecret(ctx.user.mfaSecretEnc)
      if (!secret || !verifyTotp(secret, parsed.data.code)) return fail('Invalid authentication code.', 401)
    }
    await db.user.update({where: {id: ctx.user.id}, data: {mfaEnabled: false, mfaSecretEnc: null}})
    await securityEvent({userId: ctx.user.id, type: 'mfa_disabled', ...meta})
    await notify({userId: ctx.user.id, type: 'security', title: 'Two-factor authentication disabled', body: 'MFA was disabled on your account. If you did not request this, contact us immediately.'})
    return NextResponse.json({ok: true})
  }

  return fail('Unknown action.')
}
