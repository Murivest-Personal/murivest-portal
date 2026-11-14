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
import {randomBytes, scrypt as _scrypt, timingSafeEqual} from 'node:crypto'
import {promisify} from 'node:util'
import prismaPkg from '@prisma/client'

const {PrismaClient} = prismaPkg
const scrypt = promisify(_scrypt)
const N = 16384, R = 8, P = 1, KEYLEN = 64

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('Usage: node scripts/reset-password.mjs <email> <newPassword>')
  process.exit(1)
}
if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  console.error('Password must be 10+ characters with upper & lower case, a number and a symbol.')
  process.exit(1)
}

const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') || 'db/custom.db'
const db = new PrismaClient({datasources: {db: {url: `file:${dbPath}`}}})

const user = await db.user.findUnique({where: {email: email.toLowerCase()}, select: {id: true, passwordHash: true}})
if (!user) {
  console.error(`No account found for ${email}`)
  process.exit(1)
}

const salt = randomBytes(16)
const derived = await scrypt(password.normalize('NFKC'), salt, KEYLEN, {N, r: R, p: P})
const stored = `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${derived.toString('hex')}`

await db.user.update({
  where: {id: user.id},
  data: {passwordHash: stored, failedLogins: 0, lockedUntil: null},
})

// Verify round-trip before reporting success.
const check = await db.user.findUnique({where: {id: user.id}, select: {passwordHash: true}})
const [, n, r, p, saltHex, hashHex] = check.passwordHash.split('$')
const expect = Buffer.from(hashHex, 'hex')
const got = await scrypt(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expect.length, {N: Number(n), r: Number(r), p: Number(p)})
if (got.length !== expect.length || !timingSafeEqual(got, expect)) {
  console.error('Verification failed — password was NOT reset.')
  process.exit(1)
}

console.log(`Password reset OK for ${email} (${user.id}). Hash verified against the app's verify logic.`)
await db.$disconnect()
