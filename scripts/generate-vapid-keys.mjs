#!/usr/bin/env node
/**
 * Generate a VAPID keypair for Web Push notifications.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * Prints the keys and, when --write is passed, appends them to .env
 * (only if VAPID_PUBLIC_KEY is not already present).
 *
 * Production: set these in the deployment environment, never commit them.
 * VAPID_SUBJECT must be a mailto: or https: contact, e.g.
 *   VAPID_SUBJECT=mailto:office@murivest.com
 */
import {generateVAPIDKeys} from 'web-push'
import {readFileSync, writeFileSync, existsSync} from 'node:fs'

const keys = generateVAPIDKeys()

console.log('VAPID_PUBLIC_KEY=' + keys.publicKey)
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey)
console.log('# Recommended: VAPID_SUBJECT=mailto:office@murivest.com')

if (process.argv.includes('--write')) {
  const envPath = new URL('../.env', import.meta.url).pathname
  if (!existsSync(envPath)) {
    console.error('.env not found at ' + envPath)
    process.exit(1)
  }
  const current = readFileSync(envPath, 'utf8')
  if (/^VAPID_PUBLIC_KEY=/m.test(current)) {
    console.log('VAPID keys already present in .env — nothing written.')
  } else {
    const addition = [
      '',
      '# Web Push (VAPID) — generated ' + new Date().toISOString(),
      'VAPID_PUBLIC_KEY=' + keys.publicKey,
      'VAPID_PRIVATE_KEY=' + keys.privateKey,
      'VAPID_SUBJECT=mailto:office@murivest.com',
      '',
    ].join('\n')
    writeFileSync(envPath, current.endsWith('\n') ? current + addition : current + '\n' + addition)
    console.log('Appended VAPID keys to .env')
  }
}
