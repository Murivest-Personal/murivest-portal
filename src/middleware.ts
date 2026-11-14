import {NextResponse, type NextRequest} from 'next/server'

/**
 * Edge middleware — first gate only.
 *
 * Presence of the session cookie is checked here; full cryptographic
 * validation happens server-side in getAuthContext() (src/lib/auth/context.ts)
 * on every request. Anonymous visitors hitting /portal/* are returned to
 * the landing / authentication page.
 */

const PORTAL_PREFIX = '/portal'

export function middleware(req: NextRequest) {
  const {pathname} = req.nextUrl

  if (pathname === PORTAL_PREFIX || pathname.startsWith(`${PORTAL_PREFIX}/`)) {
    const hasSession = req.cookies.has('mvr_session')
    if (!hasSession) {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = '?auth=required'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/portal', '/portal/:path*'],
}
