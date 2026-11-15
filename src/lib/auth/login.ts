import {db} from '@/lib/db'
import {generateSessionToken, hashToken, sessionExpiry, describeDevice} from './session'
import {securityEvent, notify} from './audit'
import {toIpString, userAgentOf} from './request-meta'

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
  const prior = await db.session.findFirst({
    where: {userId, device, OR: [{revokedAt: null}, {revokedAt: {not: null}}]},
    orderBy: {createdAt: 'desc'},
  })
  const isNewDevice = !prior

  const session = await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent,
      ip,
      device,
      expiresAt: sessionExpiry(),
    },
  })

  await db.user.update({where: {id: userId}, data: {lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null}})

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
  await db.session.update({where: {id: sessionId}, data: {revokedAt: new Date()}})
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: {userId, ...(exceptSessionId ? {id: {not: exceptSessionId}} : {}), revokedAt: null},
    data: {revokedAt: new Date()},
  })
}
