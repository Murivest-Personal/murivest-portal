import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {consumeAuthToken} from '@/lib/auth/tokens'
import {audit, notify} from '@/lib/auth/audit'
import {clientMeta} from '@/lib/api'
import {COMPANY} from '@/lib/constants'

/** Email verification landing (link from the welcome email). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const site = (process.env.NEXT_PUBLIC_SITE_URL || COMPANY.siteUrl).replace(/\/$/, '')
  if (!token) return NextResponse.redirect(`${site}/?auth=invalid`)
  const userId = await consumeAuthToken(token, 'email_verify')
  if (!userId) return NextResponse.redirect(`${site}/portal?verified=expired`)

  const user = await db.user.findUnique({where: {id: userId}})
  if (!user) return NextResponse.redirect(`${site}/?auth=invalid`)

  if (!user.emailVerifiedAt) {
    await db.user.update({where: {id: userId}, data: {emailVerifiedAt: new Date()}})
    await db.investorProfile.updateMany({
      where: {userId, verificationStatus: 'unverified'},
      data: {verificationStatus: 'email_verified'},
    })
    await audit({actorId: userId, action: 'auth.email_verified', ...clientMeta(req)})
    await notify({
      userId,
      type: 'system',
      title: 'Email verified',
      body: 'Your email address is confirmed. Continue institutional onboarding to unlock confidential material.',
      link: '/portal/onboarding',
    })
  }

  return NextResponse.redirect(`${site}/portal?verified=1`)
}
