import {createHmac} from 'node:crypto'

/**
 * Short-lived signed challenge cookie used between password login and the
 * TOTP step — carries only the user id + HMAC, expires in 5 minutes.
 */

export const MFA_CHALLENGE_COOKIE = 'mvr_challenge'

function sign(userId: string): string {
  const secret = process.env.SESSION_SECRET || 'dev'
  return createHmac('sha256', secret).update(userId).digest('base64url')
}

export function challengeCookieValue(userId: string): string {
  return `${userId}.${sign(userId)}`
}

export function verifyChallengeCookie(raw: string | undefined): string | null {
  if (!raw) return null
  const dot = raw.indexOf('.')
  if (dot < 1) return null
  const userId = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (sign(userId) !== sig) return null
  return userId
}
