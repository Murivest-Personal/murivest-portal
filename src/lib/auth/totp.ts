import {createCipheriv, createDecipheriv, createHmac, randomBytes} from 'node:crypto'

/**
 * RFC 6238 TOTP (30s period, 6 digits, SHA-1, ±1 step drift) implemented on
 * node:crypto — no third-party dependency in the authentication path.
 *
 * Secrets are stored AES-256-GCM encrypted with APP_ENCRYPTION_KEY.
 */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTotpSecret(): {secret: string; otpauthUrl: (account: string) => string} {
  const bytes = randomBytes(20)
  let bits = BigInt(0)
  for (const b of bytes) bits = (bits << 8n) | BigInt(b)
  let secret = ''
  for (let i = 0; i < 32; i++) {
    secret += B32[Number(bits & 31n)]
    bits >>= 5n
  }
  return {
    secret,
    otpauthUrl: (account: string) =>
      `otpauth://totp/${encodeURIComponent(`Murivest:${account}`)}?secret=${secret}&issuer=Murivest&algorithm=SHA1&digits=6&period=30`,
  }
}

function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/=+$/g, '').toUpperCase()
  let bits = 0n
  let value = 0n
  const out: number[] = []
  for (const c of clean) {
    const idx = B32.indexOf(c)
    if (idx === -1) continue
    value = (value << 5n) | BigInt(idx)
    bits += 5n
    if (bits >= 8n) {
      bits -= 8n
      out.push(Number((value >> bits) & 0xffn))
    }
  }
  return Buffer.from(out)
}

export function totpCode(secret: string, atStep: number): string {
  const counter = Buffer.alloc(8)
  counter.writeUInt32BE(Math.floor(atStep / 0x100000000), 0)
  counter.writeUInt32BE(atStep >>> 0, 4)
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(code % 1_000_000).padStart(6, '0')
}

/** Verify a submitted code with ±1 time-step tolerance; guards replay. */
export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false
  const step = Math.floor(Date.now() / 30000)
  for (const s of [step - 1, step, step + 1]) {
    if (totpCode(secret, s) === code) return true
  }
  return false
}

// --- Secret encryption at rest -------------------------------------------

function key(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'murivest-dev-only-key'
  return createHmac('sha256', secret).update('totp').digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${enc.toString('base64url')}.${tag.toString('base64url')}`
}

export function decryptSecret(payload: string): string | null {
  const [ivB64, dataB64, tagB64] = payload.split('.')
  if (!ivB64 || !dataB64 || !tagB64) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
