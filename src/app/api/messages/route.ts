import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, toCamel, toCamelList, nowIso, newId} from '@/lib/supabase'
import {messageSchema} from '@/lib/validation'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail} from '@/lib/api'
import type {EnquiryRow, MessageRow} from '@/lib/db-types'

/** POST — investor reply within a thread (or new direct note to advisor). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, messageSchema)
  if ('response' in parsed) return parsed.response
  const m = parsed.data

  if (m.enquiryId) {
    const threadRow = unwrapNullable<EnquiryRow>(
      await supabase
        .from('enquiries')
        .select('*')
        .eq('id', m.enquiryId)
        .eq('user_id', ctx.user.id)
        .maybeSingle(),
      'messages.thread',
    )
    if (!threadRow) return fail('Thread not found.', 404)
    const messageRow = unwrap<MessageRow>(
      await supabase
        .from('messages')
        .insert({
          id: newId(),
          user_id: ctx.user.id,
          sender_type: 'investor',
          enquiry_id: m.enquiryId,
          body: m.body,
          created_at: nowIso(),
        })
        .select('*')
        .single(),
      'messages.create',
    )
    const message = toCamel(messageRow)
    // Reopen the thread; updated_at is maintained by the DB trigger — not set here.
    // NOTE: sequential (no multi-table tx over PostgREST)
    unwrap<null>(
      await supabase.from('enquiries').update({status: 'open'}).eq('id', m.enquiryId),
      'messages.reopenThread',
    )
    return NextResponse.json({ok: true, message})
  }

  // Standalone message → new thread
  // NOTE: sequential (no multi-table tx over PostgREST)
  const enquiryRow = unwrap<EnquiryRow>(
    await supabase
      .from('enquiries')
      .insert({
        id: newId(),
        user_id: ctx.user.id,
        subject: 'Message to your advisor',
        message: m.body,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('*')
      .single(),
    'messages.createThread',
  )
  const enquiry = toCamel(enquiryRow)
  const messageRow = unwrap<MessageRow>(
    await supabase
      .from('messages')
      .insert({
        id: newId(),
        user_id: ctx.user.id,
        sender_type: 'investor',
        enquiry_id: enquiry.id,
        body: m.body,
        created_at: nowIso(),
      })
      .select('*')
      .single(),
    'messages.createStandalone',
  )
  const message = toCamel(messageRow)
  return NextResponse.json({ok: true, message, enquiry})
}

/** GET — messages across threads, newest first. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const messageRows = unwrap<MessageRow[]>(
    await supabase
      .from('messages')
      .select('*')
      .eq('user_id', guard.ctx.user.id)
      .order('created_at', {ascending: false})
      .limit(200),
    'messages.list',
  )
  return NextResponse.json({ok: true, messages: toCamelList(messageRows)})
}
