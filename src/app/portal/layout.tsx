import {requirePortalUser, displayName, classificationLabel, tierLabel} from '@/lib/auth/context'
import PortalShell from '@/components/portal/PortalShell'

export default async function PortalLayout({children}: {children: React.ReactNode}) {
  const ctx = await requirePortalUser()

  return (
    <PortalShell
      firstName={displayName(ctx)}
      classification={classificationLabel(ctx.profile)}
      tier={ctx.effectiveTier}
      tierLabel={tierLabel(ctx.effectiveTier)}
      email={ctx.user.email}
    >
      {children}
    </PortalShell>
  )
}
