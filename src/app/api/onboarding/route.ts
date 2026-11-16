import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, toCamel, newId, nowIso} from '@/lib/supabase'
import {onboardingStepSchema} from '@/lib/validation'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {InvestorProfileRow, OrganisationRow} from '@/lib/db-types'

/**
 * Progressive onboarding — steps:
 *  1 classification · 2 identity/organisation · 3 capacity & objectives
 *  4 preferences summary → submit for review · 5 documents · 6 done
 *
 * Access remains tier_1 until Murivest staff complete verification and
 * assign a higher tier (see /api/staff).
 */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  if (ctx.isStaff) return fail('Onboarding applies to investor accounts.')
  const parsed = await parseBody(req, onboardingStepSchema)
  if ('response' in parsed) return parsed.response
  const input = parsed.data

  const profileRow = unwrapNullable<InvestorProfileRow>(
    await supabase.from('investor_profiles').select('*').eq('user_id', ctx.user.id).maybeSingle(),
    'investorProfile.byUser',
  )
  if (!profileRow) return fail('Profile not found.', 404)
  const profile = toCamel(profileRow)

  // Organisation creation for institutional representatives
  let organisationId: string | undefined
  if (input.classification === 'institutional_rep' && input.organisationName) {
    const organisationRow = unwrapNullable<OrganisationRow>(
        await supabase
          .from('organisations')
          .select('*')
          .eq('name', input.organisationName)
          .eq('type', input.organisationType || 'institution')
          .maybeSingle(),
        'organisation.findByName',
      )
    const org =
      organisationRow ??
      unwrap<OrganisationRow>(
        await supabase
          .from('organisations')
          .insert({
            id: newId(),
            name: input.organisationName,
            type: input.organisationType || 'institution',
            created_by_id: ctx.user.id,
            created_at: nowIso(),
            updated_at: nowIso(),
          })
          .select('*')
          .single(),
        'organisation.create',
      )
    // Creator becomes organisation admin
    // NOTE: Prisma upsert (compound unique organisationId_userId) -> PostgREST
    // upsert on the same conflict target.
    unwrap<null>(
      await supabase
        .from('organisation_members')
        .upsert(
          [
            {
              id: newId(),
              organisation_id: org.id,
              user_id: ctx.user.id,
              role: 'admin',
              status: 'active',
              created_at: nowIso(),
            },
          ],
          {onConflict: 'organisation_id,user_id'},
        ),
      'organisationMember.upsert',
    )
    organisationId = org.id
  }

  const submitting = input.step >= 4

  unwrap<null>(
    await supabase
      .from('investor_profiles')
      .update({
        onboarding_step: Math.max(input.step, profile.onboardingStep),
        ...(input.classification ? {classification: input.classification} : {}),
        ...(organisationId ? {organisation_id: organisationId} : {}),
        ...(input.jobTitle !== undefined ? {job_title: input.jobTitle} : {}),
        ...(input.nationality !== undefined ? {nationality: input.nationality} : {}),
        ...(input.countryResidence !== undefined ? {country_residence: input.countryResidence} : {}),
        ...(input.phone !== undefined ? {phone: input.phone} : {}),
        ...(input.capitalCurrency ? {capital_currency: input.capitalCurrency} : {}),
        ...(input.equityAvailable !== undefined ? {equity_available: input.equityAvailable} : {}),
        ...(input.totalCapacity !== undefined ? {total_capacity: input.totalCapacity} : {}),
        ...(input.capitalFloor !== undefined ? {capital_floor: input.capitalFloor} : {}),
        ...(input.capitalCeiling !== undefined ? {capital_ceiling: input.capitalCeiling} : {}),
        ...(input.source !== undefined ? {source: input.source} : {}),
        ...(input.objectives !== undefined ? {notes: input.objectives} : {}),
        ...(submitting && profile.verificationStatus === 'email_verified'
          ? {verification_status: 'profile_submitted', kyc_status: 'submitted'}
          : {}),
      })
      .eq('user_id', ctx.user.id),
    'investorProfile.updateOnboarding',
  )

  if (submitting && profile.verificationStatus === 'email_verified') {
    await notify({
      userId: ctx.user.id,
      type: 'system',
      title: 'Onboarding submitted for review',
      body: 'Your investor profile is with our compliance team for KYC/AML verification. We will notify you as soon as your access tier is upgraded.',
      link: '/portal',
    })
    await audit({
      actorId: ctx.user.id,
      action: 'profile.submitted_for_verification',
      entity: 'profile',
      entityId: profile.id,
      ...clientMeta(req),
    })
  }

  return NextResponse.json({ok: true, step: input.step})
}
