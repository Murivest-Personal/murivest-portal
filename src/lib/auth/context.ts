import {cache} from 'react'
import {cookies} from 'next/headers'
import {redirect} from 'next/navigation'
import {NextResponse} from 'next/server'
import {supabase, unwrapNullable, toCamel, isTransientNetworkError} from '@/lib/supabase'
import {SESSION_COOKIE, hashToken} from './session'
import type {AccessTier} from '@/lib/sanity/types'
import type {InvestorProfile, InvestorProfileRow, Session, SessionRow, User, UserRow} from '@/lib/db-types'

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
 *
 * Throws `SupabaseUnavailableError` (from `@/lib/supabase`) when the
 * upstream database is transiently unreachable. `requireApiUser` catches it
 * and turns it into a 503; `requirePortalUser` lets it propagate so the
 * error boundary shows rather than silently logging the user out.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const sessionRow = unwrapNullable<SessionRow>(
    await supabase.from('sessions').select('*').eq('token_hash', hashToken(token)).maybeSingle(),
    'session.byToken',
  )
  if (!sessionRow) return null
  if (sessionRow.revoked_at || new Date(sessionRow.expires_at) < new Date()) return null

  const userRow = unwrapNullable<UserRow>(
    await supabase.from('users').select('*').eq('id', sessionRow.user_id).maybeSingle(),
    'session.user',
  )
  if (!userRow) return null
  if (userRow.status !== 'active') return null

  const profileRow = unwrapNullable<InvestorProfileRow>(
    await supabase.from('investor_profiles').select('*').eq('user_id', userRow.id).maybeSingle(),
    'session.profile',
  )

  // Rolling activity touch (throttled — no write on every request)
  if (Date.now() - new Date(sessionRow.last_seen_at).getTime() > 5 * 60 * 1000) {
    await supabase
      .from('sessions')
      .update({last_seen_at: new Date().toISOString()})
      .eq('id', sessionRow.id)
      .then(
        () => undefined,
        () => undefined,
      )
  }

  const profile = profileRow ? toCamel(profileRow) : null
  const isStaff = userRow.role === 'advisor' || userRow.role === 'admin'
  const isAdmin = userRow.role === 'admin'

  return {
    user: toCamel(userRow),
    profile,
    session: toCamel(sessionRow),
    isStaff,
    isAdmin,
    effectiveTier: effectiveTierFor(profile, isAdmin),
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

/**
 * Server-component guard: portal pages redirect anonymous users to the
 * landing page. Transient DB failures are NOT swallowed — they propagate so
 * the nearest error boundary shows "temporarily unavailable" instead of
 * misleading the user with a login redirect (which would look like a
 * silent logout).
 */
export async function requirePortalUser(): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/?auth=required')
  return ctx
}

/**
 * API guard: returns context, a 401 JSON response (anonymous), or a 503
 * JSON response (transient DB outage). Never throws for the transient case —
 * every route gets clean 503 + Retry-After semantics for free.
 */
export async function requireApiUser(): Promise<{ctx: AuthContext} | {response: NextResponse}> {
  let ctx: AuthContext | null
  try {
    ctx = await getAuthContext()
  } catch (err) {
    if (isTransientNetworkError(err)) {
      return {
        response: NextResponse.json(
          {ok: false, error: 'Authentication service is temporarily unavailable. Please retry.'},
          {status: 503, headers: {'Retry-After': '5'}},
        ),
      }
    }
    throw err
  }
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