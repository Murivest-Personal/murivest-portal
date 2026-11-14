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
 * Requires DATABASE_URL (runs Prisma via the generated client).
 */
import prismaPkg from '@prisma/client'
import {randomBytes, scrypt as _scrypt} from 'node:crypto'
import {promisify} from 'node:util'

const {PrismaClient} = prismaPkg

const scrypt = promisify(_scrypt)

async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, {N: 16384, r: 8, p: 1})
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`
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

const db = new PrismaClient()
const existing = await db.user.findUnique({where: {email: email.toLowerCase()}})
if (existing) {
  console.error('An account with this email already exists.')
  process.exit(1)
}

const user = await db.user.create({
  data: {
    email: email.toLowerCase(),
    fullName,
    passwordHash: await hashPassword(password),
    role: 'admin',
    status: 'active',
    emailVerifiedAt: new Date(),
  },
})
await db.investorProfile.create({
  data: {userId: user.id, classification: 'individual', verificationStatus: 'verified', accessTier: 'tier_3'},
})

console.log(`Admin created: ${user.email} (${user.id})`)
await db.$disconnect()
