import type {Metadata} from 'next'
import {supabase, unwrapNullable, toCamel, type CamelizeRow} from '@/lib/supabase'
import type {OrganisationRow} from '@/lib/db-types'
import {requirePortalUser, classificationLabel, tierLabel} from '@/lib/auth/context'
import ProfileEditor from '@/components/portal/ProfileEditor'
import {StatusBadge, TierBadge} from '@/components/brand/primitives'

export const metadata: Metadata = {
  title: 'Profile & Preferences',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const ctx = await requirePortalUser()
  const profile = ctx.profile
  let org: CamelizeRow<OrganisationRow> | null = null
  if (profile?.organisationId) {
    try {
      const res = await supabase
        .from('organisations')
        .select('*')
        .eq('id', profile.organisationId)
        .maybeSingle()
      const row = unwrapNullable<OrganisationRow>(res, 'organisation.get')
      org = row ? toCamel(row) : null
    } catch {
      org = null
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Investor record</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Profile &amp; Preferences</h1>
      </div>

      {/* Verification state */}
      <section className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card border border-border bg-card shadow-card p-6">
          <h2 className="mb-4 font-display text-xl text-primary">Classification &amp; verification</h2>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="eyebrow mb-1">Classification</dt>
              <dd className="text-sm font-medium text-primary">{classificationLabel(profile)}</dd>
            </div>
            <div>
              <dt className="eyebrow mb-1">Access tier</dt>
              <dd><TierBadge tier={ctx.effectiveTier} /></dd>
            </div>
            <div>
              <dt className="eyebrow mb-1">Verification status</dt>
              <dd><StatusBadge status={profile?.verificationStatus || 'unverified'} /></dd>
            </div>
            <div>
              <dt className="eyebrow mb-1">KYC status</dt>
              <dd><StatusBadge status={profile?.kycStatus || 'not_started'} /></dd>
            </div>
            <div>
              <dt className="eyebrow mb-1">AML status</dt>
              <dd><StatusBadge status={profile?.amlStatus || 'not_started'} /></dd>
            </div>
            <div>
              <dt className="eyebrow mb-1">NDA ({profile ? 'accepted' : 'pending'})</dt>
              <dd><StatusBadge status={profile?.ndaAccepted ? 'verified' : 'pending'} /></dd>
            </div>
            {org ? (
              <div className="sm:col-span-2">
                <dt className="eyebrow mb-1">Organisation</dt>
                <dd className="text-sm font-medium text-primary">
                  {org.name} · {org.type.replace('_', ' ')}
                  <span className="ml-2 inline-flex items-center border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {org.verified ? 'verified' : 'verification pending'}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            Tier and verification fields are maintained by the Murivest compliance desk — raise a tier by completing onboarding and KYC. Effective access is {tierLabel(ctx.effectiveTier)}
            {profile && profile.accessTier !== 'tier_1' && !profile.ndaAccepted ? ' (confidential tiers unlock once the NDA is accepted)' : ''}.
          </p>
        </div>

        <div className="rounded-card border border-border bg-card shadow-card p-6">
          <h2 className="mb-4 font-display text-xl text-primary">Advisor</h2>
          {profile?.advisorId ? (
            (() => {
              const a = ctx
              return (
                <div className="text-sm text-primary">
                  <div className="font-medium">{profile.advisorId ? 'Your assigned advisor' : ''}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Assigned by the desk — see Activity &amp; Communications for your secure thread.
                  </p>
                </div>
              )
            })()
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              No advisor is assigned yet — assignment follows verification. Until then, the desk responds to every enquiry under Activity &amp; Communications.
            </p>
          )}
        </div>
      </section>

      <ProfileEditor
        profile={{
          fullName: ctx.user.fullName || '',
          jobTitle: profile?.jobTitle || '',
          nationality: profile?.nationality || '',
          countryResidence: profile?.countryResidence || '',
          phone: profile?.phone || '',
          capitalCurrency: profile?.capitalCurrency || 'USD',
          equityAvailable: profile?.equityAvailable ?? null,
          totalCapacity: profile?.totalCapacity ?? null,
          capitalFloor: profile?.capitalFloor ?? null,
          capitalCeiling: profile?.capitalCeiling ?? null,
        }}
      />
    </div>
  )
}
