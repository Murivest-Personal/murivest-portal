import type {Metadata} from 'next'
import {supabase, unwrap, unwrapNullable, toCamel, toCamelList} from '@/lib/supabase'
import type {
  DocumentAccessLogRow,
  EnquiryRow,
  MandateRow,
  MessageRow,
  OrderRow,
  ScenarioRow,
  SecurityEventRow,
  UserRow,
} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import ActivityWorkspace, {type TimelineItem, type ThreadRow} from '@/components/portal/activity/ActivityWorkspace'

export const metadata: Metadata = {
  title: 'Activity & Communications',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function ActivityPage() {
  const ctx = await requirePortalUser()
  const uid = ctx.user.id

  const advisorId = ctx.profile?.advisorId || null

  const [orders, enquiries, mandates, docLogs, securityEvents, scenarios, advisor] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', {ascending: false})
      .limit(50)
      .then((res) => toCamelList(unwrap<OrderRow[]>(res, 'orders.list'))),
    supabase
      .from('enquiries')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', {ascending: false})
      .limit(50)
      .then((res) => toCamelList(unwrap<EnquiryRow[]>(res, 'enquiries.list'))),
    supabase
      .from('mandates')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', {ascending: false})
      .limit(30)
      .then((res) => toCamelList(unwrap<MandateRow[]>(res, 'mandates.recent'))),
    supabase
      .from('document_access_logs')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', {ascending: false})
      .limit(50)
      .then((res) => toCamelList(unwrap<DocumentAccessLogRow[]>(res, 'docAccessLogs.list'))),
    supabase
      .from('security_events')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', {ascending: false})
      .limit(40)
      .then((res) => toCamelList(unwrap<SecurityEventRow[]>(res, 'securityEvents.list'))),
    supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', {ascending: false})
      .limit(20)
      .then((res) => toCamelList(unwrap<ScenarioRow[]>(res, 'scenarios.recent'))),
    advisorId
      ? supabase
          .from('users')
          .select('full_name')
          .eq('id', advisorId)
          .maybeSingle()
          .then((res) => {
            const row = unwrapNullable<Pick<UserRow, 'full_name'>>(res, 'users.advisor')
            return row ? toCamel(row) : null
          })
      : Promise.resolve(null),
  ])

  // relation include (enquiry messages) → separate query + JS join
  const enquiryIds = enquiries.map((e) => e.id)
  const messageRows = enquiryIds.length
    ? toCamelList(
        unwrap<MessageRow[]>(
          await supabase.from('messages').select('*').in('enquiry_id', enquiryIds).order('created_at', {ascending: true}),
          'messages.list',
        ),
      )
    : []
  const messagesByEnquiry = new Map<string, typeof messageRows>()
  for (const m of messageRows) {
    const arr = messagesByEnquiry.get(m.enquiryId) ?? []
    arr.push(m)
    messagesByEnquiry.set(m.enquiryId, arr)
  }

  const timeline: TimelineItem[] = [
    ...orders.map((o) => ({kind: 'order', ref: o.reference, title: o.briefTitle, detail: o.customScope, occurredAt: o.createdAt, status: o.status})),
    ...enquiries.map((e) => ({kind: 'enquiry', ref: e.id, title: e.subject, detail: e.message.slice(0, 140), occurredAt: e.updatedAt, status: e.status})),
    ...mandates.map((m) => ({kind: 'mandate', ref: m.reference, title: m.title, occurredAt: m.updatedAt, status: m.status})),
    ...docLogs.map((d) => ({kind: 'document_view', ref: d.sanityDocumentId, title: d.documentTitle || 'Document access', detail: `${d.action} · logged`, occurredAt: d.createdAt.toISOString()})),
    ...securityEvents.map((s) => ({kind: 'security_event', ref: s.id, title: `${s.type.replace(/_/g, ' ')}${s.ip ? ` · ${s.ip}` : ''}`, occurredAt: s.createdAt.toISOString()})),
    ...scenarios.map((s) => ({kind: 'scenario', ref: s.id, title: s.name, detail: s.opportunityTitle, occurredAt: s.updatedAt.toISOString()})),
  ].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)).slice(0, 120)

  const threads: ThreadRow[] = enquiries.map((e) => ({
    id: e.id,
    subject: e.subject,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    sanityOpportunityId: e.sanityOpportunityId,
    opportunityTitle: e.opportunityTitle,
    messages: e.messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
    })),
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Relationship &amp; activity layer</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Activity &amp; Communications</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          One central record of your Murivest relationship — advisor threads, enquiries, order and mandate progress, document access and security events. Every interaction is preserved with a complete audit trail.
        </p>
      </div>
      <ActivityWorkspace timeline={timeline} threads={threads} advisorName={advisor?.fullName || null} />
    </div>
  )
}
