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
const ADMIN_PREFIX = '/admin'

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

  // Admin Internal System — first gate only (cookie presence). Full staff-role
  // validation happens server-side in requireAdminPage()/requireAdminApi().
  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`) || pathname.startsWith('/api/admin')) {
    const hasSession = req.cookies.has('mvr_session')
    if (!hasSession) {
      const url = req.nextUrl.clone()
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ok: false, error: 'Authentication required.'}, {status: 401})
      }
      url.pathname = '/'
      url.search = '?auth=required'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/portal', '/portal/:path*', '/admin', '/admin/:path*', '/api/admin/:path*'],
}
