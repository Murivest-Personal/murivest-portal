import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, toCamelList, nowIso, newId} from '@/lib/supabase'
import {getDocumentById, getFileAssetUrl} from '@/lib/sanity/queries'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {toIpString, userAgentOf} from '@/lib/auth/request-meta'
import type {DocumentGrantRow} from '@/lib/db-types'

type Params = {params: Promise<{id: string}>}

/**
 * Secure document delivery.
 *
 *  • Permission-checked server-side: Sanity access tier + investor's
 *    effective tier + any explicit DocumentGrant.
 *  • Files stream through this route — the Sanity asset URL (and any
 *    private-dataset token) never reaches the browser.
 *  • Every view/download writes an access log and an audit entry.
 *  • `?download=1` is honoured only when the document is flagged
 *    downloadable; otherwise the file is served inline for in-portal
 *    preview (the viewer overlays a watermark).
 */
export async function GET(req: NextRequest, {params}: Params) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const {id} = await params
  const wantsDownload = req.nextUrl.searchParams.get('download') === '1'

  const doc = await getDocumentById(id, ctx.effectiveTier)
  if (!doc) {
    // A doc may exist but be above the investor's tier — respond without
    // confirming existence.
    return NextResponse.json({error: 'Document not available at your access tier.'}, {status: 404})
  }

  // Explicit grants: if the studio granted this document to specific
  // investors/organisations, tier alone is insufficient.
  const grantRows = unwrap<DocumentGrantRow[]>(
    await supabase.from('document_grants').select('*').eq('sanity_document_id', id),
    'documentGrants.byDoc',
  )
  const grants = toCamelList(grantRows)
  if (grants.length > 0) {
    const orgId = ctx.profile?.organisationId ?? null
    const allowed = grants.some(
      (g) =>
        (g.userId === ctx.user.id && (g.permission === 'download' || !wantsDownload || g.permission === 'download')) ||
        (g.organisationId && g.organisationId === orgId && (!g.expiresAt || new Date(g.expiresAt) > new Date())),
    )
    if (!allowed) {
      return NextResponse.json({error: 'This document requires a specific grant from your advisor.'}, {status: 403})
    }
  }

  if (wantsDownload && !doc.downloadable) {
    return NextResponse.json({error: 'This document is available for in-portal preview only.'}, {status: 403})
  }

  if (!doc.fileRef) {
    return NextResponse.json({error: 'No file attached to this document yet.'}, {status: 404})
  }

  const url = await getFileAssetUrl(doc.fileRef)
  if (!url) {
    return NextResponse.json({error: 'File asset unavailable.'}, {status: 404})
  }

  const headers: Record<string, string> = {}
  if (process.env.SANITY_API_READ_TOKEN) {
    headers.Authorization = `Bearer ${process.env.SANITY_API_READ_TOKEN}`
  }
  const upstream = await fetch(url, {headers})
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({error: 'File could not be retrieved.'}, {status: 502})
  }


  // Access log + audit (view or download)
  const ip = toIpString(req)
  const ua = userAgentOf(req)
  const action = wantsDownload ? 'download' : 'view'
  unwrap<null>(
    await supabase.from('document_access_logs').insert({
      id: newId(),
      user_id: ctx.user.id,
      sanity_document_id: id,
      document_title: doc.title,
      action,
      ip,
      user_agent: ua,
      created_at: nowIso(),
    }),
    'documentAccessLogs.create',
  )
  await audit({actorId: ctx.user.id, action: `document.${action}`, entity: 'document', entityId: id, detail: {title: doc.title}, ip, userAgent: ua})

  const filename = `${doc.title.replace(/[^\w\d\-. ]+/g, '_')}${doc.fileExtension ? '.' + doc.fileExtension : ''}`
  const res = new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `${wantsDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
  return res
}
