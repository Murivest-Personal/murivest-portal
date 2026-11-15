/**
 * Remove rows created by scripts/test-dispatch.ts so the dev database stays
 * free of test artifacts. Run: node scripts/clean-test-artifacts.mjs
 */
import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const ann = await prisma.notificationAnnouncement.deleteMany({where: {title: 'Dispatch engine test announcement'}})
  const byKey = await prisma.notification.deleteMany({where: {dedupeKey: {startsWith: 'test.'}}})
  const byTitle = await prisma.notification.deleteMany({
    where: {title: {in: ['Digest-eligible notice', 'Should be fully suppressed', 'Order MVR-ORD-TEST01 · delivered']}},
  })
  const audits = await prisma.auditLog.deleteMany({
    where: {action: {in: ['notification.dispatched', 'notification.digest_sent', 'notification.suppressed_global', 'notification.announcement_sent']}},
  })
  console.log(
    `cleaned: announcements=${ann.count} notifications=${byKey.count + byTitle.count} audits=${audits.count}`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
