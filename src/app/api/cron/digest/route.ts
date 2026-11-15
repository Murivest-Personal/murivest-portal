import {type NextRequest} from 'next/server'
import {NextResponse} from 'next/server'
import {runDigest} from '@/lib/notifications/dispatch'

export const dynamic = 'force-dynamic'

/**
 * Digest batch — schedule externally (cron / pg_cron / Vercel cron):
 *   curl -X POST https://portal.murivest.com/api/cron/digest \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Sends every opted-in investor's digest (daily or weekly per their
 * settings), folding the digest_queued email deliveries into one message and
 * marking them sent in the ledger. Without CRON_SECRET configured, the
 * endpoint refuses to run (development safety).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ok: false, error: 'CRON_SECRET is not configured.'}, {status: 503})
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ok: false, error: 'Unauthorized.'}, {status: 401})

  const result = await runDigest()
  return NextResponse.json({ok: true, ...result})
}

export async function GET(req: NextRequest) {
  return POST(req)
}
