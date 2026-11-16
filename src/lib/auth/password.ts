import {randomBytes, scrypt as _scrypt, timingSafeEqual, type ScryptOptions} from 'node:crypto'
import {promisify} from 'node:util'

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

const N = 16384 // 2^14 — deliberate cost for institutional accounts
const R = 8
const P = 1
const KEYLEN = 64

/**
 * Password hashing — scrypt (memory-hard) with per-password salt.
 * Stored format: scrypt$N$R$P$<salt-hex>$<hash-hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scrypt(password.normalize('NFKC'), salt, KEYLEN, {N, r: R, p: P})) as Buffer
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltHex, hashHex] = parts
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const derived = (await scrypt(password.normalize('NFKC'), salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })) as Buffer
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters.'
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a symbol.'
  return null
}
