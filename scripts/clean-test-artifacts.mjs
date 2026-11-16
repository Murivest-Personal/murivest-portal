/**
 * Remove rows created by scripts/test-dispatch.ts so the dev database stays
 * free of test artifacts. Run: node scripts/clean-test-artifacts.mjs
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

async function main() {
  const ann = await supabase
    .from('notification_announcements')
    .delete({count: 'exact'})
    .eq('title', 'Dispatch engine test announcement')
  if (ann.error) {
    console.error(`Announcement cleanup failed: ${ann.error.message}`)
    process.exit(1)
  }

  const byKey = await supabase
    .from('notifications')
    .delete({count: 'exact'})
    .like('dedupe_key', 'test.%')
  if (byKey.error) {
    console.error(`Notification cleanup (dedupe keys) failed: ${byKey.error.message}`)
    process.exit(1)
  }

  const byTitle = await supabase
    .from('notifications')
    .delete({count: 'exact'})
    .in('title', ['Digest-eligible notice', 'Should be fully suppressed', 'Order MVR-ORD-TEST01 · delivered'])
  if (byTitle.error) {
    console.error(`Notification cleanup (titles) failed: ${byTitle.error.message}`)
    process.exit(1)
  }

  const audits = await supabase
    .schema('audit')
    .from('logs')
    .delete({count: 'exact'})
    .in('action', ['notification.dispatched', 'notification.digest_sent', 'notification.suppressed_global', 'notification.announcement_sent'])
  if (audits.error) {
    console.error(`Audit log cleanup failed: ${audits.error.message}`)
    process.exit(1)
  }

  console.log(
    `cleaned: announcements=${ann.count ?? 0} notifications=${(byKey.count ?? 0) + (byTitle.count ?? 0)} audits=${audits.count ?? 0}`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
