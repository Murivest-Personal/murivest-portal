import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, toCamel, nowIso, newId} from '@/lib/supabase'
import {documentRequestSchema} from '@/lib/validation'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'
import type {DocumentRequestRow} from '@/lib/db-types'

/** POST — request a document / information package from the desk. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, documentRequestSchema)
  if ('response' in parsed) return parsed.response
  const r = parsed.data

  const requestRow = unwrap<DocumentRequestRow>(
    await supabase
      .from('document_requests')
      .insert({
        id: newId(),
        user_id: ctx.user.id,
        subject: r.subject,
        detail: r.detail ?? null,
        sanity_opportunity_id: r.sanityOpportunityId ?? null,
        type: r.type,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('*')
      .single(),
    'documentRequests.create',
  )
  const request = toCamel(requestRow)
  await notify({
    userId: ctx.user.id,
    type: 'document',
    title: 'Request received',
    body: 'Your document request is with the Murivest desk. You will be notified when materials are ready in your Document Room.',
    link: '/portal/documents',
  })
  await audit({actorId: ctx.user.id, action: 'document.requested', entity: 'document_request', entityId: request.id, detail: {type: r.type}, ...clientMeta(req)})
  return NextResponse.json({ok: true, request})
}
