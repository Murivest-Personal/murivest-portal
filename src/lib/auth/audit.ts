import {db} from '@/lib/db'

/**
 * Audit trail + security events + notifications.
 * Every sensitive interaction (auth events, orders, payments, document
 * access, permission changes) writes here — visible to staff and mirrored
 * to audit.logs in the production PostgreSQL deployment (sql/001_schema.sql
 * defines matching DB-level triggers).
 */

export type ActorKind = 'user' | 'advisor' | 'admin' | 'system'

export async function audit(params: {
  actorId?: string | null
  actorType?: ActorKind
  action: string
  entity?: string
  entityId?: string
  detail?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      actorType: (params.actorType ?? 'user') as ActorKind,
      action: params.action,
      entity: params.entity ?? null,
      entityId: params.entityId ?? null,
      detail: (params.detail ?? undefined) as never,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  }).catch(() => {}) // audit must never break the primary flow
}

export async function securityEvent(params: {
  userId?: string | null
  type: string
  ip?: string | null
  userAgent?: string | null
  detail?: Record<string, unknown>
}) {
  await db.securityEvent.create({
    data: {
      userId: params.userId ?? null,
      type: params.type,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      detail: params.detail ? JSON.stringify(params.detail) : null,
    },
  }).catch(() => {})
}

export async function notify(params: {
  userId: string
  type: 'order_status' | 'message' | 'mandate' | 'document' | 'match' | 'security' | 'system'
  title: string
  body?: string
  link?: string
}) {
  await db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    },
  }).catch(() => {})
}

/** Generate a human-readable reference, e.g. MVR-ORD-4K7Q2A. */
export function makeReference(prefix: 'ORD' | 'MND'): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  for (const b of bytes) suffix += alphabet[b % alphabet.length]
  return `MVR-${prefix}-${suffix}`
}

export {toIpString}
