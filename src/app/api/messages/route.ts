import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {messageSchema} from '@/lib/validation'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail} from '@/lib/api'

/** POST — investor reply within a thread (or new direct note to advisor). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, messageSchema)
  if ('response' in parsed) return parsed.response
  const m = parsed.data

  if (m.enquiryId) {
    const thread = await db.enquiry.findFirst({where: {id: m.enquiryId, userId: ctx.user.id}})
    if (!thread) return fail('Thread not found.', 404)
    const message = await db.message.create({
      data: {userId: ctx.user.id, senderType: 'investor', enquiryId: m.enquiryId, body: m.body},
    })
    await db.enquiry.update({where: {id: m.enquiryId}, data: {status: 'open', updatedAt: new Date()}})
    return NextResponse.json({ok: true, message})
  }

  // Standalone message → new thread
  const enquiry = await db.enquiry.create({
    data: {userId: ctx.user.id, subject: 'Message to your advisor', message: m.body},
  })
  const message = await db.message.create({
    data: {userId: ctx.user.id, senderType: 'investor', enquiryId: enquiry.id, body: m.body},
  })
  return NextResponse.json({ok: true, message, enquiry})
}

/** GET — messages across threads, newest first. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const messages = await db.message.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {createdAt: 'desc'},
    take: 200,
  })
  return NextResponse.json({ok: true, messages})
}
