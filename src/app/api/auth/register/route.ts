import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {registerSchema} from '@/lib/validation'
import {hashPassword} from '@/lib/auth/password'
import {createSession} from '@/lib/auth/login'
import {issueAuthToken} from '@/lib/auth/tokens'
import {audit, securityEvent} from '@/lib/auth/audit'
import {sendMail} from '@/lib/mail'
import {parseBody, ok, fail, clientMeta} from '@/lib/api'
import {COMPANY} from '@/lib/constants'

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, registerSchema)
  if ('response' in parsed) return parsed.response
  const {fullName, email, password, intent} = parsed.data

  const existing = await db.user.findUnique({where: {email}})
  if (existing) return fail('An account with this email already exists. Sign in instead.', 409)

  const passwordHash = await hashPassword(password)
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: 'investor',
    },
  })
  await db.investorProfile.create({
    data: {
      userId: user.id,
      ...(intent ? {classification: intent} : {}),
    },
  })

  // Email verification
  const token = await issueAuthToken(user.id, 'email_verify')
  const verifyUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || COMPANY.siteUrl).replace(/\/$/, '')}/api/auth/verify-email?token=${encodeURIComponent(token)}`
  const mail = await sendMail({
    to: email,
    subject: 'Verify your email — Murivest Private Capital Portal',
    text: `Welcome to the Murivest private capital environment.\n\nVerify your email address to begin institutional onboarding:\n${verifyUrl}\n\nThis link expires in 72 hours.\n\n${COMPANY.legalName}\n${COMPANY.phone} · ${COMPANY.email}`,
  })

  // Immediate session (gated experience drives verification + onboarding)
  const {token: sessionToken} = await createSession(user.id, req)
  const res = NextResponse.json({ok: true, next: 'onboarding', devLink: mail.devLink})
  res.cookies.set('mvr_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })

  const meta = clientMeta(req)
  await audit({actorId: user.id, action: 'auth.register', entity: 'user', entityId: user.id, ...meta})
  await securityEvent({userId: user.id, type: 'login', ...meta})
  return res
}
