import {cache} from 'react'
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import {NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {SESSION_COOKIE, hashToken} from './session'
import type {AccessTier} from '@/lib/sanity/types'
import type {InvestorProfile, Session, User} from '@prisma/client'

export interface AuthContext {
  user: User
  profile: InvestorProfile | null
  session: Session
  isStaff: boolean
  isAdmin: boolean
  /** Tier used to gate Sanity content server-side. */
  effectiveTier: AccessTier
  onboardingComplete: boolean
}

/**
 * Resolve the signed-in investor from the opaque session cookie.
 * Cached per request; returns null for anonymous visitors.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: {tokenHash: hashToken(token)},
    include: {user: {include: {profile: true}}},
  })
  if (!session) return null
  if (session.revokedAt || session.expiresAt < new Date()) return null
  if (session.user.status !== 'active') return null

  // Rolling activity touch (throttled — no write on every request)
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.session.update({where: {id: session.id}, data: {lastSeenAt: new Date()}}).catch(() => {})
  }

  const profile = session.user.profile
  const isStaff = session.user.role === 'advisor' || session.user.role === 'admin'
  const isAdmin = session.user.role === 'admin'

  return {
    user: session.user,
    profile,
    session,
    isStaff,
    isAdmin,
    effectiveTier: effectiveTierFor(profile),
    onboardingComplete: !!profile && ['profile_submitted', 'kyc_pending', 'in_review', 'verified'].includes(profile.verificationStatus),
  }
})

/**
 * Graduated access: confidential (tier 2/3) material additionally requires
 * NDA acceptance. Admins always operate at tier_3.
 */
export function effectiveTierFor(profile: InvestorProfile | null, isAdmin = false): AccessTier {
  if (isAdmin) return 'tier_3'
  if (!profile) return 'tier_1'
  const assigned = (profile.accessTier as AccessTier) || 'tier_1'
  if (assigned !== 'tier_1' && !profile.ndaAccepted) return 'tier_1'
  return assigned
}

/** Server-component guard: portal pages redirect anonymous users to the landing page. */
export async function requirePortalUser(): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/?auth=required')
  return ctx
}

/** API guard: returns context or a 401 JSON response. */
export async function requireApiUser(): Promise<{ctx: AuthContext} | {response: NextResponse}> {
  const ctx = await getAuthContext()
  if (!ctx) {
    return {response: NextResponse.json({error: 'Authentication required.'}, {status: 401})}
  }
  return {ctx}
}

export function isResponse(x: unknown): x is {response: NextResponse} {
  return !!x && typeof x === 'object' && 'response' in (x as object)
}

export function requireStaff(ctx: AuthContext): boolean {
  return ctx.isStaff
}

export function displayName(ctx: AuthContext): string {
  return ctx.user.fullName?.split(' ')[0] || ctx.profile?.jobTitle || 'there'
}

export function classificationLabel(profile: InvestorProfile | null): string {
  switch (profile?.classification) {
    case 'uhnwi':
      return 'UHNWI'
    case 'institutional_rep':
      return 'Institutional representative'
    case 'individual':
      return 'Private investor'
    default:
      return 'Investor'
  }
}

export function tierLabel(tier: AccessTier): string {
  return {
    tier_1: 'Tier 1 · Verified',
    tier_2: 'Tier 2 · Confidential (KYC + NDA)',
    tier_3: 'Tier 3 · Institutional',
  }[tier]
}
