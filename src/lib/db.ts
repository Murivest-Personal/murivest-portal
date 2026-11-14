import {PrismaClient} from '@prisma/client'

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
