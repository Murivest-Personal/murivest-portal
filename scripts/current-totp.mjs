#!/usr/bin/env node
/**
 * Dev utility: print the current TOTP code for a user's stored (encrypted)
 * MFA secret — used for end-to-end verification of the MFA challenge flow.
 * Uses the same AES-256-GCM + RFC6238 logic as src/lib/auth/totp.ts.
 */
import prismaPkg from '@prisma/client'
import {createHmac, createDecipheriv} from 'node:crypto'

const {PrismaClient} = prismaPkg
const db = new PrismaClient()

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/current-totp.mjs <email>')
  process.exit(1)
}

const user = await db.user.findUnique({where: {email: email.toLowerCase()}})
if (!user?.mfaSecretEnc) {
  console.error('No MFA secret stored for this user (run setup first).')
  process.exit(1)
}

const key = createHmac('sha256', process.env.APP_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'murivest-dev-only-key').update('totp').digest()
const [ivB64, dataB64, tagB64] = user.mfaSecretEnc.split('.')
const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'))
decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
const secret = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8')

// base32 decode
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
let bits = 0n, value = 0n
const out = []
for (const c of secret.replace(/=+$/g, '').toUpperCase()) {
  const idx = B32.indexOf(c)
  if (idx === -1) continue
  value = (value << 5n) | BigInt(idx)
  bits += 5n
  if (bits >= 8n) { bits -= 8n; out.push(Number((value >> bits) & 0xffn)) }
}
const keyBuf = Buffer.from(out)

const step = Math.floor(Date.now() / 30000)
const counter = Buffer.alloc(8)
counter.writeUInt32BE(Math.floor(step / 0x100000000), 0)
counter.writeUInt32BE(step >>> 0, 4)
const hmac = createHmac('sha1', keyBuf).update(counter).digest()
const offset = hmac[hmac.length - 1] & 0xf
const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
console.log(String(code % 1_000_000).padStart(6, '0'))

await db.$disconnect()
