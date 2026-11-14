import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {enquirySchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'

/** POST — submit an enquiry to the Murivest desk (optionally about an opportunity). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, enquirySchema)
  if ('response' in parsed) return parsed.response
  const e = parsed.data

  const enquiry = await db.enquiry.create({
    data: {
      userId: ctx.user.id,
      subject: e.subject,
      message: e.message,
      sanityOpportunityId: e.sanityOpportunityId ?? null,
      opportunityTitle: e.opportunityTitle ?? null,
    },
  })
  // Investor's own copy in the thread
  await db.message.create({
    data: {userId: ctx.user.id, senderType: 'investor', enquiryId: enquiry.id, body: e.message},
  })

  await audit({actorId: ctx.user.id, action: 'enquiry.created', entity: 'enquiry', entityId: enquiry.id, detail: {subject: e.subject}, ...clientMeta(req)})
  return NextResponse.json({ok: true, enquiry})
}

/** GET — enquiry threads with messages. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const enquiries = await db.enquiry.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {updatedAt: 'desc'},
    include: {messages: {orderBy: {createdAt: 'asc'}}},
  })
  return NextResponse.json({ok: true, enquiries})
}
