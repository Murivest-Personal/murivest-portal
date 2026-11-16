#!/usr/bin/env node
/**
 * Murivest Private Capital Portal — Realtime websocket leg, end-to-end check.
 *
 *   node scripts/verify-realtime.mjs
 *
 * Verifies the active-notification transport the app uses:
 *  1. a "server" client (service role) joins a per-user channel and
 *     broadcasts a notification event — exactly what notifyUser() does;
 *  2. a "browser" client joins the SAME channel and must receive the
 *     broadcast — exactly what the portal/admin toaster does. It uses the
 *     anon key when NEXT_PUBLIC_SUPABASE_ANON_KEY is set (the production
 *     path), otherwise a second service-role client (transport check only).
 *
 * Exit code 0 = websocket leg verified. Also run this after enabling
 * Realtime or changing keys/URL in Supabase.
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (see .env.example).')
  process.exit(1)
}

const mode = anonKey ? 'anon key (production browser path)' : 'service-role x2 (transport check only; set NEXT_PUBLIC_SUPABASE_ANON_KEY for the true browser path)'
console.log(`Realtime check against ${url}`)
console.log(`Listener client: ${mode}`)

const CHANGED = 8_000
const channel = `notif:verify-${Math.random().toString(36).slice(2, 10)}`

const server = createClient(url, serviceKey, {auth: {persistSession: false, autoRefreshToken: false}})
const browser = createClient(url, anonKey ?? serviceKey, {auth: {persistSession: false, autoRefreshToken: false}})

function subscribe(client, name, label) {
  return new Promise((resolve, reject) => {
    const ch = client.channel(name)
    const timer = setTimeout(() => reject(new Error(`${label}: subscribe timeout`)), CHANGED / 2)
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve(ch)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`${label}: ${status}`))
      }
    })
  })
}

async function main() {
  const browserChannelPromise = subscribe(browser, channel, 'browser')
  const serverChannel = await subscribe(server, channel, 'server')
  const browserChannel = await browserChannelPromise // both sides joined before sending

  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('browser: no broadcast received within timeout')), CHANGED)
    browserChannel.on('broadcast', {event: 'notification'}, (msg) => {
      clearTimeout(timer)
      resolve(msg.payload)
    })
  })

  const payload = {
    id: 'verify-' + Date.now(),
    category: 'system',
    event: null,
    priority: 'normal',
    title: 'Realtime verification',
    body: 'Supabase websocket broadcast received end-to-end.',
    link: '/portal',
    createdAt: new Date().toISOString(),
  }
  const res = await serverChannel.send({type: 'broadcast', event: 'notification', payload})
  console.log(`server broadcast send() -> ${res}`)
  const got = await received
  console.log('browser received:', JSON.stringify(got))

  const ok = got && got.id === payload.id && got.title === payload.title
  console.log(ok ? 'OK — realtime websocket leg verified end-to-end.' : 'FAIL — payload mismatch.')
  try {
    await server.removeAllChannels()
    await browser.removeAllChannels()
  } catch {}
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error('FAIL —', err.message)
  console.error('Check: Supabase project reachable, Realtime enabled (Dashboard → Database → Replication → Realtime is on by default), keys valid.')
  process.exit(1)
})
