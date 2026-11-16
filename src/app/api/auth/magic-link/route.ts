import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrapNullable} from '@/lib/supabase'
import {magicLinkSchema} from '@/lib/validation'
import {issueAuthToken, consumeAuthToken} from '@/lib/auth/tokens'
import {createSession} from '@/lib/auth/login'
import {sendMail} from '@/lib/mail'
import {parseBody, ok, clientMeta} from '@/lib/api'
import {audit} from '@/lib/auth/audit'
import {COMPANY} from '@/lib/constants'
import type {UserRow} from '@/lib/db-types'

/** POST — request a magic link (never reveals whether the account exists). */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, magicLinkSchema)
  if ('response' in parsed) return parsed.response
  const {email} = parsed.data

  const userRow = unwrapNullable<UserRow>(
    await supabase.from('users').select('*').eq('email', email).maybeSingle(),
    'user.byEmail',
  )
  if (userRow && userRow.status === 'active') {
    const token = await issueAuthToken(userRow.id, 'magic_link')
    const url = `${(process.env.NEXT_PUBLIC_SITE_URL || COMPANY.siteUrl).replace(/\/$/, '')}/api/auth/magic-link?token=${encodeURIComponent(token)}`
    const mail = await sendMail({
      to: email,
      subject: 'Your Murivest sign-in link',
      text: `Sign in to the Murivest Private Capital Portal:\n${url}\n\nThis link expires in 15 minutes and can be used once.\n\n${COMPANY.legalName}`,
    })
    const res: Record<string, unknown> = {ok: true, message: 'If that address is registered, a sign-in link is on the way.'}
    if (mail.devLink) res.devLink = mail.devLink
    return NextResponse.json(res)
  }
  return ok({message: 'If that address is registered, a sign-in link is on the way.'})
}

/** GET — consume the token, create a session, land in the portal. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const site = (process.env.NEXT_PUBLIC_SITE_URL || COMPANY.siteUrl).replace(/\/$/, '')
  if (!token) return NextResponse.redirect(`${site}/?auth=invalid`)
  const userId = await consumeAuthToken(token, 'magic_link')
  if (!userId) return NextResponse.redirect(`${site}/?auth=expired`)

  const userRow = unwrapNullable<UserRow>(
    await supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    'user.byId',
  )
  if (!userRow || userRow.status !== 'active') return NextResponse.redirect(`${site}/?auth=invalid`)

  const {token: sessionToken} = await createSession(userId, req)
  await audit({actorId: userId, action: 'auth.login.magic_link', ...clientMeta(req)})

  const res = NextResponse.redirect(`${site}/portal`)
  res.cookies.set('mvr_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })
  return res
}
