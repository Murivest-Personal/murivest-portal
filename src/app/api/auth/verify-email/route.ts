import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, nowIso} from '@/lib/supabase'
import {consumeAuthToken} from '@/lib/auth/tokens'
import {audit, notify} from '@/lib/auth/audit'
import {clientMeta} from '@/lib/api'
import {COMPANY} from '@/lib/constants'
import type {UserRow} from '@/lib/db-types'

/** Email verification landing (link from the welcome email). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const site = (process.env.NEXT_PUBLIC_SITE_URL || COMPANY.siteUrl).replace(/\/$/, '')
  if (!token) return NextResponse.redirect(`${site}/?auth=invalid`)
  const userId = await consumeAuthToken(token, 'email_verify')
  if (!userId) return NextResponse.redirect(`${site}/portal?verified=expired`)

  const userRow = unwrapNullable<UserRow>(
    await supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    'user.byId',
  )
  if (!userRow) return NextResponse.redirect(`${site}/?auth=invalid`)

  if (!userRow.email_verified_at) {
    unwrap<null>(
      await supabase.from('users').update({email_verified_at: nowIso()}).eq('id', userId),
      'user.markEmailVerified',
    )
    // Prisma updateMany -> PostgREST filtered update
    unwrap<null>(
      await supabase
        .from('investor_profiles')
        .update({verification_status: 'email_verified'})
        .eq('user_id', userId)
        .eq('verification_status', 'unverified'),
      'investorProfile.markEmailVerified',
    )
    await audit({actorId: userId, action: 'auth.email_verified', ...clientMeta(req)})
    await notify({
      userId,
      type: 'system',
      event: 'security.verification_update',
      title: 'Email verified',
      body: 'Your email address is confirmed. Continue institutional onboarding to unlock confidential material.',
      link: '/portal/onboarding',
      emailVars: {alertTitle: 'Email verified', alertDetail: 'Your email address is confirmed. Continue institutional onboarding to unlock confidential material.'},
    })
  }

  return NextResponse.redirect(`${site}/portal?verified=1`)
}
