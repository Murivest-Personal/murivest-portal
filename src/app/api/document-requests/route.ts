import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {documentRequestSchema} from '@/lib/validation'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'

/** POST — request a document / information package from the desk. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, documentRequestSchema)
  if ('response' in parsed) return parsed.response
  const r = parsed.data

  const request = await db.documentRequest.create({
    data: {
      userId: ctx.user.id,
      subject: r.subject,
      detail: r.detail ?? null,
      sanityOpportunityId: r.sanityOpportunityId ?? null,
      type: r.type,
    },
  })
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
