#!/usr/bin/env node
/**
 * Murivest Private Capital Portal — first-run administrator bootstrap.
 *
 *   node scripts/create-admin.mjs office@murivest.com 'Full Name' 'Passw0rd!'
 *
 * Creates the first admin account (and profile) using the same scrypt
 * password hashing the application uses. Subsequent staff accounts are
 * created by an admin through POST /api/staff {action:'create_advisor'}.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).
 */
import {createClient} from '@supabase/supabase-js'
import {randomBytes, randomUUID, scrypt as _scrypt} from 'node:crypto'
import {promisify} from 'node:util'
import {readFileSync} from 'node:fs'

const scrypt = promisify(_scrypt)

async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, {N: 16384, r: 8, p: 1})
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`
}

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

const [email, fullName, password] = process.argv.slice(2)
if (!email || !fullName || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <fullName> <password>')
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

const existing = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle()
if (existing.error) {
  console.error(`User lookup failed: ${existing.error.message}`)
  process.exit(1)
}
if (existing.data) {
  console.error('An account with this email already exists.')
  process.exit(1)
}

const now = new Date().toISOString()
const inserted = await supabase
  .from('users')
  .insert({
    id: randomUUID(),
    email: email.toLowerCase(),
    full_name: fullName,
    password_hash: await hashPassword(password),
    role: 'admin',
    status: 'active',
    email_verified_at: now,
    created_at: now,
    updated_at: now,
  })
  .select('id, email')
  .single()
if (inserted.error) {
  console.error(`User insert failed: ${inserted.error.message}`)
  process.exit(1)
}
const user = inserted.data

const profile = await supabase.from('investor_profiles').insert({
  id: randomUUID(),
  user_id: user.id,
  classification: 'individual',
  verification_status: 'verified',
  access_tier: 'tier_3',
  created_at: now,
  updated_at: now,
})
if (profile.error) {
  console.error(`Investor profile insert failed: ${profile.error.message}`)
  process.exit(1)
}

console.log(`Admin created: ${user.email} (${user.id})`)
