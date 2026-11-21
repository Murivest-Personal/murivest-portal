import {NextResponse, type NextRequest} from 'next/server'
import {differentialInputSchema, runDifferentialUnderwriting} from '@/lib/finance/differential'
import {parseBody, ok, fail} from '@/lib/api'

/**
 * Public Differential Underwriting endpoint.
 *
 * POST /api/underwriting  { asset, income, market, costs, debt fields }
 *   → { ok, result } — the three competing explanations of value, the offer
 *     ladder, debt capacity, rent guidance and the differential spread.
 *
 * Pure computation: no database writes, no session, no PII storage. The
 * property details an investor enters are used for the calculation in this
 * request only. Figures are illustrative until verified in a formal
 * Differential Investigation.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, differentialInputSchema)
  if ('response' in parsed) return parsed.response
  const input = parsed.data

  try {
    const result = runDifferentialUnderwriting(input)
    const res = ok({result})
    res.headers.set('Cache-Control', 'no-store')
    return res as NextResponse
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Underwriting computation failed.'
    return fail(message, 500)
  }
}
