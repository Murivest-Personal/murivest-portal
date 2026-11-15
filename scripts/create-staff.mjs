#!/usr/bin/env node
/**
 * Murivest Admin Internal System — staff bootstrap.
 *
 *   node scripts/create-staff.mjs office@murivest.com 'Full Name' 'Passw0rd!' finance 'Head of Finance'
 *
 * Creates a staff account with a granular admin role (StaffProfile) using the
 * same scrypt hashing the application uses. For local/dev databases only —
 * in production, staff are created by a Super Administrator through the Admin
 * system (Settings → Staff & roles), which is fully audit-logged.
 */
import prismaPkg from '@prisma/client'
import {randomBytes, scrypt as _scrypt} from 'node:crypto'
import {promisify} from 'node:util'

const {PrismaClient} = prismaPkg
const scrypt = promisify(_scrypt)

const ROLES = ['super_admin', 'ops_lead', 'advisor', 'compliance', 'finance', 'content', 'analyst']

async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, {N: 16384, r: 8, p: 1})
  return `scrypt$16384$8$1$${salt.toString('hex')}$${derived.toString('hex')}`
}

const [email, fullName, password, adminRole, title] = process.argv.slice(2)
if (!email || !fullName || !password || !adminRole) {
  console.error('Usage: node scripts/create-staff.mjs <email> <fullName> <password> <adminRole> [title]')
  console.error(`Roles: ${ROLES.join(', ')}`)
  process.exit(1)
}
if (!ROLES.includes(adminRole)) {
  console.error(`Unknown admin role "${adminRole}". Valid roles: ${ROLES.join(', ')}`)
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
    role: adminRole === 'advisor' ? 'advisor' : 'admin',
    status: 'active',
    emailVerifiedAt: new Date(),
  },
})
await db.staffProfile.create({
  data: {userId: user.id, adminRole, title: title ?? null},
})

console.log(`Staff created: ${user.email} (${user.id}) — admin role: ${adminRole}`)
await db.$disconnect()
