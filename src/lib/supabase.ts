import {createClient, type PostgrestError, type SupabaseClient} from '@supabase/supabase-js'

// ============================================================================
// Murivest Private Capital Portal — Supabase client (server-only)
// ----------------------------------------------------------------------------
// Replaces the former Prisma runtime (src/lib/db.ts). All DB access goes
// through this client, created with the SERVICE ROLE key: server-side reads
// and writes only, full-privilege. It MUST never be imported from client
// components and the key must never appear in the browser bundle.
//
//   import {supabase, unwrap, toCamel} from '@/lib/supabase'
//
//   const {data, error} = await supabase.from('orders').select('*')
//
// Connection shape (Supabase Dashboard → Settings → API):
//   NEXT_PUBLIC_SUPABASE_URL        — project URL (https://<ref>.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY       — service_role secret, server-side only
//
// The production DDL (sql/00*.sql) keeps every table in the `portal` schema
// (audit rows live in the `audit` schema). The client therefore pins
// db.schema = 'portal' (PostgREST Accept-/Content-Profile switching) and the
// Supabase project must expose the `portal` and `audit` schemas under
// Settings → API → "Exposed schemas" (comma-separated, keep `public`).
//
// RLS posture: the service_role Postgres role bypasses Row Level Security by
// design. Row-level isolation for investor data is enforced by the
// application layer (requireApiUser / tier checks) exactly as before;
// sql/002_rls.sql + 005_admin_rls.sql remain in force as defense-in-depth
// for any non-service-role access path.
//
// NOTE — the lazy proxy below defers construction until first use, so a
// missing configuration surfaces as ONE clear error at the first query
// instead of crashing every import during build/dev without credentials.
// ============================================================================

let cached: SupabaseClient<any, any, 'portal'> | undefined

function resolve(): SupabaseClient<any, any, 'portal'> {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      '[supabase] Database client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY in the environment (Supabase Dashboard → Settings → API). ' +
        'The service role key is server-side only — never expose it to the browser.',
    )
  }
  cached = createClient(url, serviceKey, {
    db: {schema: 'portal'}, // DDL keeps tables in the `portal` schema
    auth: {persistSession: false, autoRefreshToken: false},
    global: {headers: {'X-Client-Info': 'murivest-portal-server'}},
  })
  return cached
}

/** Supabase client (service role). Property access constructs it lazily. */
export const supabase: SupabaseClient<any, any, 'portal'> = new Proxy({} as SupabaseClient<any, any, 'portal'>, {
  get(_target, prop) {
    if (prop === 'then') return undefined // not a thenable
    const client = resolve()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
})

/** True when both Supabase env vars are present (health checks / empty states). */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// ---------------------------------------------------------------------------
// Result helpers — every PostgREST response goes through these so errors
// never slip through silently.
// ---------------------------------------------------------------------------

/** Unwrap a `{data, error}` result, throwing a descriptive Error on failure.
 *  ALWAYS pass the explicit row type: `unwrap<OrderRow[]>(res, 'orders.list')`. */
export function unwrap<T>(res: {data: T | null; error: PostgrestError | null}, ctx?: string | undefined): T {
  if (res.error) {
    throw new Error(
      `[db${ctx ? `:${ctx}` : ''}] ${res.error.message} (code ${res.error.code ?? '—'}, details ${res.error.details ?? '—'})`,
    )
  }
  return res.data as T
}

/** Unwrap a nullable `{data, error}` result (`.maybeSingle()` reads).
 *  ALWAYS pass the explicit row type: `unwrapNullable<SessionRow>(res, 'session.byToken')`. */
export function unwrapNullable<T>(res: {data: T | null; error: PostgrestError | null}, ctx?: string): T | null {
  return unwrap<T | null>(res, ctx)
}

/** Extract the count from a `{count: 'exact', head: true}` select. */
export function unwrapCount(res: {count: number | null; error: PostgrestError | null}, ctx?: string): number {
  if (res.error) {
    throw new Error(`[db${ctx ? `:${ctx}` : ''}] ${res.error.message} (code ${res.error.code ?? '—'})`)
  }
  return res.count ?? 0
}

// ---------------------------------------------------------------------------
// Row-shape helpers — the production DDL is snake_case; application code
// keeps camelCase. Convert at the boundary; values (incl. jsonb payloads)
// are passed through untouched (shallow, key-level conversion only).
// ---------------------------------------------------------------------------

type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Rest}`
  ? `${Head}${SnakeToCamel<Capitalize<Rest>>}`
  : S

/** camelCase view of a snake_case DB row (same values, renamed top-level keys). */
export type CamelizeRow<T> = {
  [K in keyof T as SnakeToCamel<K & string>]: T[K]
}

const camelRe = /_([a-z0-9])/g
const snakeRe = /([a-z0-9])([A-Z])/g

/** snake_case row -> camelCase object (shallow: jsonb values unchanged). */
export function toCamel<T extends object>(row: T): CamelizeRow<T> {
  const source = row as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(source)) {
    out[k.replace(camelRe, (_, c: string) => c.toUpperCase())] = v
  }
  return out as CamelizeRow<T>
}

/** Map toCamel over a row array (null-safe). */
export function toCamelList<T extends object>(rows: T[] | null | undefined): CamelizeRow<T>[] {
  return (rows ?? []).map((r) => toCamel(r))
}

/** camelCase object -> snake_case payload for insert/update (shallow). */
export function toSnake<T extends object>(obj: T): Record<string, unknown> {
  const source = obj as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(source)) {
    out[k.replace(snakeRe, '$1_$2').toLowerCase()] = v
  }
  return out
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

/** ISO timestamp for explicit column values (inserts / manual updates). */
export function nowIso(): string {
  return new Date().toISOString()
}

/** Fresh row id (Prisma cuid() replacement — DDL ids are TEXT, no default). */
export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Audit log table handle — rows live in the separate `audit` schema
 * (`audit.logs`), reached via PostgREST schema switching. Requires `audit`
 * exposed in Supabase Settings → API → Exposed schemas.
 */
export function auditTable() {
  return supabase.schema('audit').from('logs')
}
