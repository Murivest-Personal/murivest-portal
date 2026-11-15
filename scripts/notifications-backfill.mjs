#!/usr/bin/env node
/**
 * One-off migration helper: backfill `notifications.category` /
 * `notifications.priority` for rows created before the multi-channel
 * notification system (legacy coarse `type` values).
 *
 *   node scripts/notifications-backfill.mjs
 */
import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

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
    const res = await prisma.notification.updateMany({
      where: {type, event: null},
      data: {category, priority: LEGACY_PRIORITY[type] ?? 'normal'},
    })
    updated += res.count
  }
  console.log(`Backfilled ${updated} notification row(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
