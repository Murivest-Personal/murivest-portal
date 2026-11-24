import {
  auditTable,
  supabase,
  newId,
  nowIso,
  isTransientNetworkError,
  unwrap,
  toCamelList,
} from '@/lib/supabase'
import {notifyUser} from '@/lib/notifications/dispatch'
import type {NotificationPriority} from '@/lib/notifications/events'
import {toIpString} from './request-meta'

/**
 * Audit trail + security events + notifications.
 * Every sensitive interaction (auth events, orders, payments, document
 * access, permission changes) writes here — visible to staff and mirrored
 * to audit.logs in the production PostgreSQL deployment (sql/001_schema.sql
 * defines matching DB-level triggers).
 *
 * notify() is the single entry point used across the codebase; it delegates
 * to the multi-channel dispatcher (src/lib/notifications/dispatch.ts) which
 * resolves the investor's channel × category preferences, quiet hours and
 * digest opt-in, then records every delivery attempt in the ledger.
 *
 * Storage: Supabase client (service role). Audit rows live in the `audit`
 * schema (audit.logs — see auditTable() in src/lib/supabase.ts); security
 * events in portal.security_events.
 */

export type ActorKind = 'user' | 'advisor' | 'admin' | 'system'

/** Snake_case row shape of `audit.logs` (matches sql/001_schema.sql). */
export interface AuditLogRow {
  id: string
  actor_id: string | null
  actor_type: ActorKind
  action: string
  entity: string | null
  entity_id: string | null
  detail: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

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
  try {
    await auditTable().insert({
      id: newId(),
      actor_id: params.actorId ?? null,
      actor_type: (params.actorType ?? 'user') as ActorKind,
      action: params.action,
      entity: params.entity ?? null,
      entity_id: params.entityId ?? null,
      detail: params.detail ?? null,
      ip: params.ip ?? null,
      user_agent: params.userAgent ?? null,
      created_at: nowIso(),
    })
  } catch (err) {
    // audit must never break the primary flow — but surface transient
    // upstream failures so operators can see the pipe is down.
    if (isTransientNetworkError(err)) {
      // eslint-disable-next-line no-console
      console.warn('[audit] transient write failure (audit row dropped):', (err as Error).message)
    }
  }
}

export async function securityEvent(params: {
  userId?: string | null
  type: string
  ip?: string | null
  userAgent?: string | null
  detail?: Record<string, unknown>
}) {
  try {
    await supabase.from('security_events').insert({
      id: newId(),
      user_id: params.userId ?? null,
      type: params.type,
      ip: params.ip ?? null,
      user_agent: params.userAgent ?? null,
      detail: params.detail ? JSON.stringify(params.detail) : null,
      created_at: nowIso(),
    })
  } catch (err) {
    // security-event capture must never break the primary flow
    if (isTransientNetworkError(err)) {
      // eslint-disable-next-line no-console
      console.warn('[audit] transient write failure (security event dropped):', (err as Error).message)
    }
  }
}

export interface NotifyParams {
  userId: string
  type: 'order_status' | 'message' | 'mandate' | 'document' | 'match' | 'security' | 'system'
  title: string
  body?: string
  link?: string
  /** Fine-grained event key (src/lib/notifications/events.ts EVENT_CATALOG). */
  event?: string
  priority?: NotificationPriority
  /** Non-sensitive context (entity titles, references) for email templates. */
  emailVars?: Record<string, string>
  /** Idempotency key — identical events within 48h collapse into one row. */
  dedupeKey?: string
}

export async function notify(params: NotifyParams): Promise<void> {
  await notifyUser({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    event: params.event,
    priority: params.priority,
    emailVars: params.emailVars,
    dedupeKey: params.dedupeKey,
  })
}

/**
 * Audit trail for an investor — every action they performed (actor_id) AND
 * every action taken against their profile record (entity='profile' AND
 * entity_id=userId). Newest first.
 *
 * Note the PostgREST filter syntax: a nested group MUST be introduced by an
 * explicit logical operator (`and(...)` / `or(...)` / `not.and(...)`). A bare
 * `(a.eq.x,b.eq.y)` group is rejected with PGRST100 — that was the bug.
 */
export async function investorTrail(userId: string, limit = 100) {
  const res = await auditTable()
    .select('*')
    .or(`actor_id.eq."${userId}",(entity.eq."profile" and entity_id.eq."${userId}")`)
    .order('created_at', {ascending: false})
    .limit(limit)
  return toCamelList(unwrap<AuditLogRow[]>(res, 'audit.investorTrail'))
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