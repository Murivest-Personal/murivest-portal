import {randomBytes, createHash} from 'node:crypto'
import {db} from '@/lib/db'

/**
 * Single-use, hashed, expiring tokens for email verification, magic links
 * and password resets — the emailed URL carries the raw token; only its
 * sha-256 is stored.
 */

export type TokenPurpose = 'email_verify' | 'magic_link' | 'password_reset'

const TTL_MINUTES: Record<TokenPurpose, number> = {
  email_verify: 60 * 24 * 3, // 3 days
  magic_link: 15,
  password_reset: 30,
}

export async function issueAuthToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.authToken.create({
    data: {
      userId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      purpose,
      expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60 * 1000),
    },
  })
  return token
}

export async function consumeAuthToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const hash = createHash('sha256').update(token).digest('hex')
  const record = await db.authToken.findUnique({where: {tokenHash: hash}})
  if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date()) return null
  await db.authToken.update({where: {id: record.id}, data: {usedAt: new Date()}})
  return record.userId
}

export function tokenUrl(base: string, token: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || base
  return `${site.replace(/\/$/, '')}${base}?token=${encodeURIComponent(token)}`
}
