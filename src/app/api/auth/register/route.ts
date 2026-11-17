import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, newId, nowIso} from '@/lib/supabase'
import {registerSchema} from '@/lib/validation'
import {hashPassword} from '@/lib/auth/password'
import {createSession} from '@/lib/auth/login'
import {issueAuthToken} from '@/lib/auth/tokens'
import {audit, securityEvent} from '@/lib/auth/audit'
import {sendMail} from '@/lib/mail'
import {parseBody, fail, clientMeta} from '@/lib/api'
import {COMPANY} from '@/lib/constants'
import type {UserRow} from '@/lib/db-types'

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, registerSchema)
  if ('response' in parsed) return parsed.response
  const {fullName, email, password, intent} = parsed.data

  const existingRow = unwrapNullable<UserRow>(
    await supabase.from('users').select('*').eq('email', email).maybeSingle(),
    'user.byEmail',
  )
  if (existingRow) return fail('An account with this email already exists. Sign in instead.', 409)

  const passwordHash = await hashPassword(password)
  const userRow = unwrap<UserRow>(
    await supabase
      .from('users')
      .insert({
        id: newId(),
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role: 'investor',
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('*')
      .single(),
    'user.create',
  )

  // Investor profile — core to registration; surface as error if it fails.
  try {
    unwrap<null>(
      await supabase
        .from('investor_profiles')
        .insert({
          id: newId(),
          user_id: userRow.id,
          ...(intent ? {classification: intent} : {}),
          created_at: nowIso(),
          updated_at: nowIso(),
        }),
      'investorProfile.create',
    )
  } catch (err) {
    console.error('[register:investorProfile]', err)
    return fail('Account created but profile setup failed. Please sign in.', 500)
  }

  // Email verification token — best effort; registration still completes without it.
  let token: string | null = null
  try {
    token = await issueAuthToken(userRow.id, 'email_verify')
  } catch (err) {
    console.error('[register:issueAuthToken]', err)
  }

  const verifyUrl = token
    ? `${(process.env.NEXT_PUBLIC_SITE_URL || COMPANY.siteUrl).replace(/\/$/, '')}/api/auth/verify-email?token=${encodeURIComponent(token)}`
    : null
  const mail = await sendMail({
    to: email,
    subject: 'Verify your email — Murivest Private Capital Portal',
    text: `Welcome to the Murivest private capital environment.\n\n${verifyUrl ? `Verify your email address to begin institutional onboarding:\n${verifyUrl}\n` : ''}This link expires in 72 hours.\n\n${COMPANY.legalName}\n${COMPANY.phone} · ${COMPANY.email}`,
  })

  // Immediate session — best effort; registration still completes without it.
  let sessionToken: string | null = null
  try {
    const {token: st} = await createSession(userRow.id, req)
    sessionToken = st
  } catch (err) {
    console.error('[register:createSession]', err)
  }

  const res = NextResponse.json({ok: true, next: 'onboarding', devLink: mail.devLink})
  if (sessionToken) {
    res.cookies.set('mvr_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
  }

  const meta = clientMeta(req)
  await audit({actorId: userRow.id, action: 'auth.register', entity: 'user', entityId: userRow.id, ...meta})
  await securityEvent({userId: userRow.id, type: 'login', ...meta})
  return res
}
