import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody} from '@/lib/api'

const schema = z.object({ids: z.array(z.string().max(64)).max(100).optional(), all: z.boolean().optional()})

/** POST — mark notifications read (single, batch, or all). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = await parseBody(req, schema)
  if ('response' in parsed) return parsed.response
  const {ids, all} = parsed.data

  if (all) {
    await db.notification.updateMany({
      where: {userId: guard.ctx.user.id, readAt: null},
      data: {readAt: new Date()},
    })
  } else if (ids && ids.length > 0) {
    await db.notification.updateMany({
      where: {userId: guard.ctx.user.id, id: {in: ids}, readAt: null},
      data: {readAt: new Date()},
    })
  }
  return NextResponse.json({ok: true})
}

/** GET — notifications feed for the bell. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const notifications = await db.notification.findMany({
    where: {userId: guard.ctx.user.id},
    orderBy: {createdAt: 'desc'},
    take: 50,
  })
  const unread = notifications.filter((n) => !n.readAt).length
  return NextResponse.json({ok: true, notifications, unread})
}
