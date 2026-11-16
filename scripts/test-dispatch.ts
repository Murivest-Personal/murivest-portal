/**
 * End-to-end dispatch engine test (dev sandbox):
 *   1. notifyUser with event order.delivered  → notification + in_app sent
 *      + push skipped (no subscription) + email attempted (SMTP not
 *      configured → failed with detail, masked address)
 *   2. digest path: enable email for a digest-eligible category + digest on
 *      → digest_queued → runDigest() transitions the row
 *   3. dispatchAnnouncement → announcement row + recipient notifications
 *
 * Run: bun run scripts/test-dispatch.ts <userId>
 */
import {supabase, nowIso, newId} from '../src/lib/supabase'

async function show(label: string, notificationId: string) {
  const res = await supabase
    .from('notification_deliveries')
    .select('*')
    .eq('notification_id', notificationId)
    .order('created_at', {ascending: true})
  if (res.error) throw new Error(`[db:deliveries.list] ${res.error.message}`)
  const deliveries = res.data ?? []
  console.log(`\n[${label}] deliveries for ${notificationId}:`)
  for (const d of deliveries) {
    console.log(`  ${d.channel.padEnd(7)} ${d.status.padEnd(13)} addr=${d.address ?? '-'} detail=${d.detail ?? '-'} msgId=${d.message_id ?? '-'}`)
  }
}

async function main() {
  const userId = process.argv[2]
  if (!userId) {
    console.error('Usage: bun run scripts/test-dispatch.ts <userId>')
    process.exit(1)
  }

  const {notifyUser, sendDigestForUser, dispatchAnnouncement} = await import('../src/lib/notifications/dispatch')

  // --- 1. Immediate high-priority event -----------------------------------
  const r1 = await notifyUser({
    userId,
    title: 'Order MVR-ORD-TEST01 · delivered',
    body: '“Test Institutional Brief” has been delivered to your Document Room.',
    link: '/portal/documents',
    event: 'order.delivered',
    type: 'order_status',
    emailVars: {briefTitle: 'Test Institutional Brief', orderRef: 'MVR-ORD-TEST01'},
    dedupeKey: `test.order.delivered.${Date.now()}`,
  })
  console.log('1) order.delivered →', r1)
  await show('order.delivered', r1.notificationId!)

  // --- 2. Digest path ------------------------------------------------------
  const digestOn = await supabase
    .from('notification_settings')
    .upsert([{id: newId(), user_id: userId, digest_enabled: true, created_at: nowIso(), updated_at: nowIso()}], {onConflict: 'user_id'})
  if (digestOn.error) throw new Error(`[db:settings.digestOn] ${digestOn.error.message}`)
  const emailPrefOn = await supabase
    .from('notification_preferences')
    .upsert(
      [{id: newId(), user_id: userId, channel: 'email', category: 'system', enabled: true, created_at: nowIso(), updated_at: nowIso()}],
      {onConflict: 'user_id,channel,category'},
    )
  if (emailPrefOn.error) throw new Error(`[db:preferences.emailOn] ${emailPrefOn.error.message}`)

  const r2 = await notifyUser({
    userId,
    title: 'Digest-eligible notice',
    body: 'Folded into the next digest.',
    link: '/portal',
    event: 'system.announcement',
    type: 'system',
    priority: 'normal',
    dedupeKey: `test.digest.${Date.now()}`,
  })
  await show('digest-eligible', r2.notificationId!)

  const digest = await sendDigestForUser(userId)
  console.log('digest run →', digest)
  await show('after digest', r2.notificationId!)

  // cleanup the test preference so defaults resume
  const prefsCleanup = await supabase
    .from('notification_preferences')
    .delete()
    .eq('user_id', userId)
    .eq('channel', 'email')
    .eq('category', 'system')
  if (prefsCleanup.error) throw new Error(`[db:preferences.cleanup] ${prefsCleanup.error.message}`)

  // --- 3. Announcement -----------------------------------------------------
  const adminRes = await supabase.from('users').select('id').eq('role', 'admin').limit(1).maybeSingle()
  if (adminRes.error) throw new Error(`[db:users.admin] ${adminRes.error.message}`)
  const admin = adminRes.data
  if (admin) {
    const r3 = await dispatchAnnouncement({
      title: 'Dispatch engine test announcement',
      body: 'This is an automated engine test — no action required.',
      link: '/portal',
      audience: {userIds: [userId]},
      createdById: admin.id,
    })
    console.log('3) announcement →', r3)
    const recipients = await supabase
      .from('notifications')
      .select('*', {count: 'exact', head: true})
      .eq('announcement_id', r3.announcementId)
    if (recipients.error) throw new Error(`[db:notifications.recipients] ${recipients.error.message}`)
    console.log(`   recipients with rows: ${recipients.count ?? 0}`)
  }

  // --- 4. Suppression / global switch sanity ------------------------------
  const beforeRes = await supabase
    .from('notification_settings')
    .select('global_enabled, digest_enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (beforeRes.error) throw new Error(`[db:settings.before] ${beforeRes.error.message}`)
  const before = beforeRes.data
  const globalOff = await supabase
    .from('notification_settings')
    .upsert([{id: newId(), user_id: userId, global_enabled: false, created_at: nowIso(), updated_at: nowIso()}], {onConflict: 'user_id'})
  if (globalOff.error) throw new Error(`[db:settings.globalOff] ${globalOff.error.message}`)
  const r4 = await notifyUser({
    userId,
    title: 'Should be fully suppressed',
    body: 'category: orders',
    event: 'order.status_change',
    type: 'order_status',
    dedupeKey: `test.suppressed.${Date.now()}`,
  })
  console.log('4) global off (orders) →', r4)
  const restore = await supabase
    .from('notification_settings')
    .update({global_enabled: before?.global_enabled ?? true, digest_enabled: before?.digest_enabled ?? false})
    .eq('user_id', userId)
  if (restore.error) throw new Error(`[db:settings.restore] ${restore.error.message}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
