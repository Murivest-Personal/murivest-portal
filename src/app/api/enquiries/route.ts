import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, toCamel, toCamelList, nowIso, newId} from '@/lib/supabase'
import {enquirySchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, clientMeta} from '@/lib/api'
import type {EnquiryRow, MessageRow} from '@/lib/db-types'

/** POST — submit an enquiry to the Murivest desk (optionally about an opportunity). */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, enquirySchema)
  if ('response' in parsed) return parsed.response
  const e = parsed.data

  const enquiryRow = unwrap<EnquiryRow>(
    await supabase
      .from('enquiries')
      .insert({
        id: newId(),
        user_id: ctx.user.id,
        subject: e.subject,
        message: e.message,
        sanity_opportunity_id: e.sanityOpportunityId ?? null,
        opportunity_title: e.opportunityTitle ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('*')
      .single(),
    'enquiries.create',
  )
  const enquiry = toCamel(enquiryRow)
  // Investor's own copy in the thread
  // NOTE: sequential (no multi-table tx over PostgREST)
  unwrap<null>(
    await supabase.from('messages').insert({
      id: newId(),
      user_id: ctx.user.id,
      sender_type: 'investor',
      enquiry_id: enquiry.id,
      body: e.message,
      created_at: nowIso(),
    }),
    'messages.createEnquiryCopy',
  )

  await audit({actorId: ctx.user.id, action: 'enquiry.created', entity: 'enquiry', entityId: enquiry.id, detail: {subject: e.subject}, ...clientMeta(req)})
  return NextResponse.json({ok: true, enquiry})
}

/** GET — enquiry threads with messages. */
export async function GET() {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const enquiryRows = unwrap<EnquiryRow[]>(
    await supabase
      .from('enquiries')
      .select('*')
      .eq('user_id', guard.ctx.user.id)
      .order('updated_at', {ascending: false}),
    'enquiries.list',
  )
  // Former Prisma `include: {messages}` → follow-up query + JS join.
  const messagesByEnquiry = new Map<string, MessageRow[]>()
  if (enquiryRows.length > 0) {
    const messageRows = unwrap<MessageRow[]>(
      await supabase
        .from('messages')
        .select('*')
        .in('enquiry_id', enquiryRows.map((enq) => enq.id))
        .order('created_at', {ascending: true}),
      'messages.byEnquiries',
    )
    for (const row of messageRows) {
      const bucket = messagesByEnquiry.get(row.enquiry_id)
      if (bucket) bucket.push(row)
      else messagesByEnquiry.set(row.enquiry_id, [row])
    }
  }
  const enquiries = enquiryRows.map((row) => ({
    ...toCamel(row),
    messages: toCamelList(messagesByEnquiry.get(row.id) ?? []),
  }))
  return NextResponse.json({ok: true, enquiries})
}
