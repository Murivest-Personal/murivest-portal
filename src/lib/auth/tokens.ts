import {randomBytes, createHash} from 'node:crypto'
import {supabase, unwrap, unwrapNullable} from '@/lib/supabase'
import type {AuthTokenRow} from '@/lib/db-types'

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
  unwrap(
    await supabase.from('auth_tokens').insert({
      user_id: userId,
      token_hash: createHash('sha256').update(token).digest('hex'),
      purpose,
      expires_at: new Date(Date.now() + TTL_MINUTES[purpose] * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    }),
    'authToken.issue',
  )
  return token
}

export async function consumeAuthToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const hash = createHash('sha256').update(token).digest('hex')
  const record = unwrapNullable<AuthTokenRow>(
    await supabase.from('auth_tokens').select('*').eq('token_hash', hash).maybeSingle(),
    'authToken.consume',
  )
  if (!record || record.purpose !== purpose || record.used_at || new Date(record.expires_at) < new Date()) {
    return null
  }
  unwrap(
    await supabase.from('auth_tokens').update({used_at: new Date().toISOString()}).eq('id', record.id),
    'authToken.markUsed',
  )
  return record.user_id
}

export function tokenUrl(base: string, token: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || base
  return `${site.replace(/\/$/, '')}${base}?token=${encodeURIComponent(token)}`
}
