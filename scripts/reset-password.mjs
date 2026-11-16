#!/usr/bin/env node
/**
 * Murivest Private Capital Portal — dev-only password reset.
 *
 *   node scripts/reset-password.mjs <email> <newPassword>
 *
 * Rewrites the scrypt password hash for an existing local account using
 * the exact same hashing scheme as src/lib/auth/password.ts, and clears
 * any failed-login lockout. For local/dev databases only — production
 * resets must go through the SMTP reset flow (POST /api/auth/password).
 */
import {createClient} from '@supabase/supabase-js'
import {randomBytes, scrypt as _scrypt, timingSafeEqual} from 'node:crypto'
import {promisify} from 'node:util'
import {readFileSync} from 'node:fs'

const scrypt = promisify(_scrypt)
const N = 16384, R = 8, P = 1, KEYLEN = 64

// node does not read .env automatically — tiny loader for the repo-root .env
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of txt.split('\n')) {
      if (!line.trim() || line.trim().startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 1) continue
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch {}
}

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('Usage: node scripts/reset-password.mjs <email> <newPassword>')
  process.exit(1)
}
if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  console.error('Password must be 10+ characters with upper & lower case, a number and a symbol.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).')
  process.exit(1)
}
const supabase = createClient(url, key, {db: {schema: 'portal'}, auth: {persistSession: false, autoRefreshToken: false}})

const lookup = await supabase.from('users').select('id, password_hash').eq('email', email.toLowerCase()).maybeSingle()
if (lookup.error) {
  console.error(`User lookup failed: ${lookup.error.message}`)
  process.exit(1)
}
const user = lookup.data
if (!user) {
  console.error(`No account found for ${email}`)
  process.exit(1)
}

const salt = randomBytes(16)
const derived = await scrypt(password.normalize('NFKC'), salt, KEYLEN, {N, r: R, p: P})
const stored = `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${derived.toString('hex')}`

const updated = await supabase
  .from('users')
  .update({password_hash: stored, failed_logins: 0, locked_until: null})
  .eq('id', user.id)
if (updated.error) {
  console.error(`Password update failed: ${updated.error.message}`)
  process.exit(1)
}

// Verify round-trip before reporting success.
const check = await supabase.from('users').select('password_hash').eq('id', user.id).maybeSingle()
if (check.error) {
  console.error(`Verify read failed: ${check.error.message}`)
  process.exit(1)
}
if (!check.data?.password_hash) {
  console.error('Verification failed — password was NOT reset.')
  process.exit(1)
}
const [, n, r, p, saltHex, hashHex] = check.data.password_hash.split('$')

const expect = Buffer.from(hashHex, 'hex')
const got = await scrypt(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expect.length, {N: Number(n), r: Number(r), p: Number(p)})
if (got.length !== expect.length || !timingSafeEqual(got, expect)) {
  console.error('Verification failed — password was NOT reset.')
  process.exit(1)
}

console.log(`Password reset OK for ${email} (${user.id}). Hash verified against the app's verify logic.`)
