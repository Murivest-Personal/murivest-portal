import type {Metadata} from 'next'
import {db} from '@/lib/db'
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

  const [orders, enquiries, mandates, docLogs, securityEvents, scenarios, advisor] = await Promise.all([
    db.order.findMany({where: {userId: uid}, orderBy: {createdAt: 'desc'}, take: 50}),
    db.enquiry.findMany({
      where: {userId: uid},
      orderBy: {updatedAt: 'desc'},
      take: 50,
      include: {messages: {orderBy: {createdAt: 'asc'}}},
    }),
    db.mandate.findMany({where: {userId: uid}, orderBy: {updatedAt: 'desc'}, take: 30}),
    db.documentAccessLog.findMany({where: {userId: uid}, orderBy: {createdAt: 'desc'}, take: 50}),
    db.securityEvent.findMany({where: {userId: uid}, orderBy: {createdAt: 'desc'}, take: 40}),
    db.scenario.findMany({where: {userId: uid}, orderBy: {updatedAt: 'desc'}, take: 20}),
    ctx.profile?.advisorId ? db.user.findUnique({where: {id: ctx.profile.advisorId}, select: {fullName: true}}) : Promise.resolve(null),
  ])

  const timeline: TimelineItem[] = [
    ...orders.map((o) => ({kind: 'order', ref: o.reference, title: o.briefTitle, detail: o.customScope, occurredAt: o.createdAt.toISOString(), status: o.status})),
    ...enquiries.map((e) => ({kind: 'enquiry', ref: e.id, title: e.subject, detail: e.message.slice(0, 140), occurredAt: e.updatedAt.toISOString(), status: e.status})),
    ...mandates.map((m) => ({kind: 'mandate', ref: m.reference, title: m.title, occurredAt: m.updatedAt.toISOString(), status: m.status})),
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
