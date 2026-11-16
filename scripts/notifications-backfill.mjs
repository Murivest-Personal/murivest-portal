#!/usr/bin/env node
/**
 * One-off migration helper: backfill `notifications.category` /
 * `notifications.priority` for rows created before the multi-channel
 * notification system (legacy coarse `type` values).
 *
 *   node scripts/notifications-backfill.mjs
 */
import {createClient} from '@supabase/supabase-js'
import {readFileSync} from 'node:fs'

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).')
  process.exit(1)
}
const supabase = createClient(url, key, {db: {schema: 'portal'}, auth: {persistSession: false, autoRefreshToken: false}})

const LEGACY_CATEGORY = {
  order_status: 'orders',
  message: 'messages',
  mandate: 'mandates',
  document: 'documents',
  match: 'opportunities',
  security: 'security',
  system: 'system',
}

const LEGACY_PRIORITY = {
  security: 'critical',
  message: 'high',
  order_status: 'normal',
  mandate: 'normal',
  document: 'normal',
  match: 'low',
  system: 'normal',
}

async function main() {
  let updated = 0
  for (const [type, category] of Object.entries(LEGACY_CATEGORY)) {
    const res = await supabase
      .from('notifications')
      .update({category, priority: LEGACY_PRIORITY[type] ?? 'normal'}, {count: 'exact'})
      .eq('type', type)
      .is('event', null)
    if (res.error) {
      console.error(`Backfill for legacy type "${type}" failed: ${res.error.message}`)
      process.exit(1)
    }
    updated += res.count ?? 0
  }
  console.log(`Backfilled ${updated} notification row(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
