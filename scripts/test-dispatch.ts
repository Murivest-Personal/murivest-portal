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
import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

async function show(label: string, notificationId: string) {
  const deliveries = await prisma.notificationDelivery.findMany({
    where: {notificationId},
    orderBy: {createdAt: 'asc'},
  })
  console.log(`\n[${label}] deliveries for ${notificationId}:`)
  for (const d of deliveries) {
    console.log(`  ${d.channel.padEnd(7)} ${d.status.padEnd(13)} addr=${d.address ?? '-'} detail=${d.detail ?? '-'} msgId=${d.messageId ?? '-'}`)
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
  await prisma.notificationSetting.upsert({
    where: {userId},
    create: {userId, digestEnabled: true},
    update: {digestEnabled: true},
  })
  await prisma.notificationPreference.upsert({
    where: {userId_channel_category: {userId, channel: 'email', category: 'system'}},
    create: {userId, channel: 'email', category: 'system', enabled: true},
    update: {enabled: true},
  })
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
  await prisma.notificationPreference.deleteMany({where: {userId, channel: 'email', category: 'system'}})

  // --- 3. Announcement -----------------------------------------------------
  const admin = await prisma.user.findFirst({where: {role: 'admin'}, select: {id: true}})
  if (admin) {
    const r3 = await dispatchAnnouncement({
      title: 'Dispatch engine test announcement',
      body: 'This is an automated engine test — no action required.',
      link: '/portal',
      audience: {userIds: [userId]},
      createdById: admin.id,
    })
    console.log('3) announcement →', r3)
    const count = await prisma.notification.count({where: {announcementId: r3.announcementId}})
    console.log(`   recipients with rows: ${count}`)
  }

  // --- 4. Suppression / global switch sanity ------------------------------
  const before = await prisma.notificationSetting.findUnique({where: {userId}})
  await prisma.notificationSetting.upsert({where: {userId}, create: {userId, globalEnabled: false}, update: {globalEnabled: false}})
  const r4 = await notifyUser({
    userId,
    title: 'Should be fully suppressed',
    body: 'category: orders',
    event: 'order.status_change',
    type: 'order_status',
    dedupeKey: `test.suppressed.${Date.now()}`,
  })
  console.log('4) global off (orders) →', r4)
  await prisma.notificationSetting.update({where: {userId}, data: {globalEnabled: before?.globalEnabled ?? true, digestEnabled: before?.digestEnabled ?? false}})
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
