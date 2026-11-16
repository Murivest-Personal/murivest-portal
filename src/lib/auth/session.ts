import {randomBytes, createHash} from 'node:crypto'

export const SESSION_COOKIE = 'mvr_session'
export const MFA_CHALLENGE_COOKIE = 'mvr_challenge'
const SESSION_TTL_DAYS = 30

/**
 * Opaque session tokens: 32 random bytes, base64url. Only the sha-256 of
 * the token is persisted, so a database disclosure cannot be replayed.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/** Friendly device label from a user-agent string (device recognition UX). */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device'
  const ua = userAgent
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) && /Version\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : 'Browser'
  const os =
    /Windows NT 10/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS'
  const mobile = /Mobile|Android|iPhone/.test(ua) ? ' · mobile' : ''
  return `${browser} · ${os}${mobile}`
}

export const cookieOptions = (maxAgeSeconds: number) =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }) as const

export const SESSION_MAX_AGE = SESSION_TTL_DAYS * 24 * 60 * 60
