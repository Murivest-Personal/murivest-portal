import {requireAdminPage} from '@/lib/admin/rbac'
import {organisationList} from '@/lib/admin/queries'
import {fmtDate, relativeTime} from '@/lib/format'
import {PageHeader, SectionCard, StatusPill, EmptyState} from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminOrganisationsPage() {
  await requireAdminPage()
  const organisations = await organisationList()

  return (
    <div>
      <PageHeader
        eyebrow="Institutional relationships"
        title="Organisations"
        description="Family offices, funds, corporates and institutions — hierarchy, representative permissions and membership standing."
      />
      <SectionCard title="Organisation register" description={`${organisations.length} organisations`}>
        {organisations.length === 0 ? (
          <EmptyState title="No organisations yet" description="Institutional investors create or join organisations during onboarding." />
        ) : (
          <ul className="space-y-4">
            {organisations.map((o) => (
              <li key={o.id} className="border border-border">
                <div className="flex flex-col gap-2 border-b border-border bg-secondary/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base text-primary">{o.name}</span>
                      <StatusPill status={o.type} label={o.type.replace(/_/g, ' ')} />
                      {o.verified ? <StatusPill status="verified" label="Verified" /> : <StatusPill status="pending" label="Unverified" />}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {o.legalName ?? o.name} · {o.country ?? 'country not stated'} · joined {fmtDate(o.createdAt)}
                      {o.website ? ` · ${o.website}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{o.members.length} member{o.members.length === 1 ? '' : 's'}</div>
                </div>
                <div className="px-4 py-3">
                  {o.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No members yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {o.members.map((m) => (
                        <li key={m.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <span className="text-sm text-primary">{m.name}</span>
                            <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{m.role}{m.title ? ` · ${m.title}` : ''}</span>
                            <div className="text-[10px] text-muted-foreground">{m.email}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusPill status={m.status === 'active' ? 'active' : m.status === 'invited' ? 'pending' : 'rejected'} />
                            <span className="text-[10px] text-muted-foreground">login {m.lastLoginAt ? relativeTime(m.lastLoginAt) : 'never'}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
