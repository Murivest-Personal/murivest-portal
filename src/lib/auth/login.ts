import {supabase, unwrap, unwrapNullable, toCamel, nowIso, newId} from '@/lib/supabase'
import {generateSessionToken, hashToken, sessionExpiry, describeDevice} from './session'
import {securityEvent, notify} from './audit'
import {toIpString, userAgentOf} from './request-meta'
import type {SessionRow} from '@/lib/db-types'

/**
 * Session lifecycle: creation with device recognition, revocation.
 */

export async function createSession(userId: string, req: Request) {
  const token = generateSessionToken()
  const userAgent = userAgentOf(req)
  const ip = toIpString(req)

  // Device recognition: if this user has no prior session with this device
  // signature, record a security event and notify the investor.
  const device = describeDevice(userAgent)
  const prior = unwrapNullable<Pick<SessionRow, 'id'>>(
    await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('device', device)
      .order('created_at', {ascending: false})
      .limit(1)
      .maybeSingle(),
    'session.priorDevice',
  )
  const isNewDevice = !prior

  const sessionRow = unwrap<SessionRow>(
    await supabase
      .from('sessions')
      .insert({
        id: newId(),
        user_id: userId,
        token_hash: hashToken(token),
        user_agent: userAgent,
        ip,
        device,
        expires_at: sessionExpiry().toISOString(),
        created_at: nowIso(),
      })
      .select('*')
      .single(),
    'session.create',
  )
  const session = toCamel(sessionRow)

  unwrap(
    await supabase
      .from('users')
      .update({last_login_at: nowIso(), failed_logins: 0, locked_until: null})
      .eq('id', userId),
    'users.touchLogin',
  )

  if (isNewDevice) {
    await securityEvent({userId, type: 'new_device', ip, userAgent, detail: {device}})
    await notify({
      userId,
      type: 'security',
      event: 'security.new_device',
      title: 'New sign-in detected',
      body: `A new device (${device}) signed in to your Murivest workspace. If this was not you, revoke the session under Account & Security immediately.`,
      link: '/portal/security',
      emailVars: {
        alertTitle: 'New sign-in detected',
        alertDetail: `A new device (${device}) signed in to your Murivest workspace. If this was not you, revoke the session under Account & Security immediately and contact us.`,
      },
    })
  }

  return {token, session, isNewDevice}
}

export async function revokeSession(sessionId: string) {
  unwrap(
    await supabase.from('sessions').update({revoked_at: nowIso()}).eq('id', sessionId),
    'session.revoke',
  )
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  let query = supabase
    .from('sessions')
    .update({revoked_at: nowIso()})
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (exceptSessionId) query = query.not('id', 'eq', exceptSessionId)
  unwrap(await query, 'session.revokeAll')
}
