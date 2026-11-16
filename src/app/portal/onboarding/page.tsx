import type {Metadata} from 'next'
import {supabase, unwrapNullable, toCamel} from '@/lib/supabase'
import type {OrganisationRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import OnboardingWizard from '@/components/portal/OnboardingWizard'

export const metadata: Metadata = {
  title: 'Investor onboarding',
  robots: {index: false, follow: false},
}

export default async function OnboardingPage() {
  const ctx = await requirePortalUser()
  const profile = ctx.profile
  const orgRow = profile?.organisationId
    ? unwrapNullable<OrganisationRow>(
        await supabase.from('organisations').select('*').eq('id', profile.organisationId).maybeSingle(),
        'organisation.get',
      )
    : null
  const org = orgRow ? toCamel(orgRow) : null

  return (
    <div>
      <div className="mb-10">
        <div className="eyebrow mb-2">Institutional onboarding</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Welcome to Murivest.</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {ctx.user.fullName ? `${ctx.user.fullName}, five` : 'Five'} short steps now save hours later — and everything you enter is reused by the Studio, Discover matching and your mandates.
        </p>
      </div>
      <OnboardingWizard
        defaults={{
          classification: profile?.classification || 'individual',
          jobTitle: profile?.jobTitle || '',
          nationality: profile?.nationality || '',
          countryResidence: profile?.countryResidence || '',
          phone: profile?.phone || '',
          capitalCurrency: profile?.capitalCurrency || 'USD',
          equityAvailable: profile?.equityAvailable ?? null,
          totalCapacity: profile?.totalCapacity ?? null,
          capitalFloor: profile?.capitalFloor ?? null,
          capitalCeiling: profile?.capitalCeiling ?? null,
          organisationName: org?.name || '',
          organisationType: org?.type || 'family_office',
          source: profile?.source || '',
          emailVerified: !!ctx.user.emailVerifiedAt,
        }}
      />
    </div>
  )
}
