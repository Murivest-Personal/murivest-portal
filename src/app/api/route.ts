import {NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {isSanityConfigured} from '@/lib/sanity/client'

/** Health / readiness probe (no data disclosure). */
export async function GET() {
  let database = 'ok'
  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    database = 'unavailable'
  }
  return NextResponse.json({
    status: 'ok',
    service: 'murivest-private-capital-portal',
    database,
    contentSource: isSanityConfigured() ? 'sanity' : 'awaiting-configuration',
    time: new Date().toISOString(),
  })
}
