import {createClient, type PostgrestError, type SupabaseClient} from '@supabase/supabase-js'

// ============================================================================
// Murivest Private Capital Portal — Supabase client (server-only)
// ----------------------------------------------------------------------------
// All DB access goes
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
//
// RESILIENCE — the production Supabase project is reached over the public
// internet; TLS resets (ECONNRESET / "socket disconnected before secure TLS
// connection was established") are unavoidable and were previously
// surfacing as 500s on every request. This module now:
//   • retries idempotent / transport-level failures with jittered
//     exponential backoff inside a custom `fetch` passed to the client;
//   • classifies transient failures as `SupabaseUnavailableError` so that
//     upstream routes can return 503 + Retry-After instead of 500.
// Sustained outages are still surfaced to the client — the retries only
// smooth over sub-second blips, they do not mask a real outage.
// ============================================================================

// ---------------------------------------------------------------------------
// Transient network error classification
// ---------------------------------------------------------------------------

/**
 * Substrings (case-insensitive) that identify a transport-level failure
 * from `undici` / Node's `fetch` / TLS layer. These are the errors we want
 * to retry and surface as 503, not 500.
 */
const TRANSIENT_NETWORK_PATTERNS = [
  'fetch failed',
  'econnreset',
  'econnaborted',
  'etimedout',
  'econnrefused',
  'socket disconnected',
  'socket hang up',
  'enotfound',
  'eai_again',
  'network socket',
  'network error',
  'network connection',
  'connection closed',
  'connection reset',
]

/** True when a free-form error message looks like a transient network failure. */
export function isTransientMessage(message: string | undefined | null): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return TRANSIENT_NETWORK_PATTERNS.some((pattern) => m.includes(pattern))
}

/**
 * Classify a thrown error (or its `.cause` chain) as a transient network
 * failure. Walks the cause chain because `undici` wraps the useful
 * `ECONNRESET` two levels deep: `TypeError: fetch failed → Error: Client
 * network socket disconnected … (ECONNRESET)`.
 */
export function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false
  if (err instanceof SupabaseUnavailableError) return true
  if (err instanceof Error) {
    if (isTransientMessage(err.message)) return true
    const cause = (err as {cause?: unknown}).cause
    if (cause && cause !== err) return isTransientNetworkError(cause)
  }
  return false
}

/**
 * Thrown by `unwrap` / `unwrapNullable` / `unwrapCount` when the underlying
 * PostgREST call failed at the transport level (TLS reset, DNS failure,
 * timeout). Callers should respond with `503 Service Unavailable` and a
 * `Retry-After` header — NOT a 500. The error is always retriable at the
 * HTTP layer; the in-process fetch retry has already been exhausted.
 */
export class SupabaseUnavailableError extends Error {
  readonly retriable = true
  override readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'SupabaseUnavailableError'
    this.cause = cause
  }
}

// ---------------------------------------------------------------------------
// Custom fetch with exponential backoff + jitter
// ---------------------------------------------------------------------------

const MAX_FETCH_ATTEMPTS = 3
const BASE_DELAY_MS = 150

/**
 * Retry fetch on transport-level failures only. The retry is safe even for
 * non-idempotent verbs because a transport failure means the request most
 * likely never reached the server (or, if it did, the connection was torn
 * before a response was read — the alternative is a guaranteed failure for
 * the user, so we prefer the small chance of a duplicate over a hard 500).
 */
async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init)
    } catch (err) {
      lastErr = err
      const signal = init?.signal
      const cancelled = signal?.aborted ?? false
      const finalAttempt = attempt === MAX_FETCH_ATTEMPTS
      if (cancelled || !isTransientNetworkError(err) || finalAttempt) {
        throw err
      }
      // Jittered exponential backoff: ~150ms, ~300ms (with 0–100ms of noise).
      const jitter = Math.floor(Math.random() * 100)
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + jitter
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  // Unreachable — the loop either returns or throws. Kept for type-narrowing.
  throw lastErr
}

// ---------------------------------------------------------------------------
// Client construction (lazy — see header note)
// ---------------------------------------------------------------------------

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
    global: {
      headers: {'X-Client-Info': 'murivest-portal-server'},
      fetch: fetchWithRetry,
    },
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
 *  ALWAYS pass the explicit row type: `unwrap<OrderRow[]>(res, 'orders.list')`.
 *  Transport-level failures throw `SupabaseUnavailableError` (retriable, 503).
 *  Query-level failures throw a plain `Error` (500). */
export function unwrap<T>(res: {data: T | null; error: PostgrestError | null}, ctx?: string | undefined): T {
  if (res.error) {
    const prefix = `[db${ctx ? `:${ctx}` : ''}]`
    if (isTransientMessage(res.error.message)) {
      throw new SupabaseUnavailableError(
        `${prefix} Supabase is temporarily unreachable: ${res.error.message}`,
        res.error,
      )
    }
    throw new Error(
      `${prefix} ${res.error.message} (code ${res.error.code ?? '—'}, details ${res.error.details ?? '—'})`,
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
    const prefix = `[db${ctx ? `:${ctx}` : ''}]`
    if (isTransientMessage(res.error.message)) {
      throw new SupabaseUnavailableError(
        `${prefix} Supabase is temporarily unreachable: ${res.error.message}`,
        res.error,
      )
    }
    throw new Error(`${prefix} ${res.error.message} (code ${res.error.code ?? '—'})`)
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