import type {NextRequest} from 'next/server'

/**
 * Request metadata extraction (IP / user-agent) for audit logging.
 * X-Forwarded-For is honoured because the app is deployed behind a reverse
 * proxy (Caddy / platform edge).
 */

export function toIpString(req: NextRequest | Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return null
}

export function userAgentOf(req: NextRequest | Request): string | null {
  return req.headers.get('user-agent')
}
