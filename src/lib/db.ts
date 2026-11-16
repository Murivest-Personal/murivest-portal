import {PrismaClient} from '@prisma/client'

// ---------------------------------------------------------------------------
// Supavisor guard (production PostgreSQL on Supabase)
//
// Supabase's direct `db.<project-ref>.supabase.co` host is IPv6-only and
// bypasses pooling — per Supabase's guidance the Prisma runtime must go
// through the Supavisor TRANSACTION pooler (port 6543) with
// `?pgbouncer=true`. Warn loudly at boot if the direct host is configured
// so the misconfiguration is impossible to miss. The migration-only
// connection belongs in DIRECT_URL (session pooler :5432 / direct host),
// wired via directUrl in the prisma datasource.
// ---------------------------------------------------------------------------
const RUNTIME_DB_URL = process.env.DATABASE_URL ?? ''
if (/^postgres(?:ql)?:\/\/[^@]*@db\.[a-z0-9-]+\.supabase\.co(?::5432)?\//.test(RUNTIME_DB_URL)) {
  console.warn(
    '[db] DATABASE_URL points at the DIRECT db.<ref>.supabase.co host. ' +
      'Use the Supavisor transaction pooler for the runtime instead: ' +
      'postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1 ' +
      '(see README → Database and .env.example). The direct or session-pooler ' +
      'string belongs in DIRECT_URL, used only by prisma db push / migrate / psql.',
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Row-Level-Security context binding (production PostgreSQL).
 *
 * sql/002_rls.sql keys every policy on current_setting('app.user_id') /
 * current_setting('app.actor_role'). When running against PostgreSQL, wrap
 * sensitive read/write paths so the database enforces investor isolation
 * beneath the application-layer guards:
 *
 *   const rows = await withUserContext(user.id, user.role, (tx) =>
 *     tx.order.findMany({ where: { userId: user.id } }))
 *
 * All queries inside the callback MUST use the provided transaction client.
 * Transparent no-op on the SQLite dev runtime (returns the shared client).
 *
 * Supavisor-safe (transaction pooler, :6543): set_config(…, true) is
 * transaction-scoped and Prisma interactive transactions pin a single
 * pooled backend for the whole BEGIN…COMMIT span, so the RLS context
 * applies to every statement inside the callback. `?pgbouncer=true`
 * on DATABASE_URL (required in transaction mode) disables prepared
 * statements without affecting this pattern.
 */
export async function withUserContext<T>(
  userId: string,
  role: 'investor' | 'advisor' | 'admin' | 'user' = 'user',
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  const isPostgres = process.env.DATABASE_URL?.startsWith('postgres')
  if (!isPostgres) return fn(db)
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.user_id', '${userId.replace(/'/g, "''")}', true)`)
    await tx.$executeRawUnsafe(`SELECT set_config('app.actor_role', '${role}', true)`)
    return fn(tx as unknown as PrismaClient)
  })
}
