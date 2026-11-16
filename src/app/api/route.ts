import {NextResponse} from 'next/server'
import {supabase} from '@/lib/supabase'
import {isSanityConfigured} from '@/lib/sanity/client'

/** Health / readiness probe (no data disclosure). */
export async function GET() {
  let database = 'ok'
  try {
    // Liveness ping over PostgREST (replaces the former Prisma `SELECT 1`
    // raw query): a head-only count request — no rows are returned. The
    // Supabase client resolves errors instead of throwing, so surface them
    // here to keep the probe honest.
    const res = await supabase.from('users').select('id', {count: 'exact', head: true})
    if (res.error) throw new Error(res.error.message)
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
