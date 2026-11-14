import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {onboardingStepSchema} from '@/lib/validation'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'

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

  const profile = await db.investorProfile.findUnique({where: {userId: ctx.user.id}})
  if (!profile) return fail('Profile not found.', 404)

  // Organisation creation for institutional representatives
  let organisationId: string | undefined
  if (input.classification === 'institutional_rep' && input.organisationName) {
    const existing = await db.organisation.findFirst({
      where: {name: input.organisationName, type: input.organisationType || 'institution'},
    })
    const org =
      existing ??
      (await db.organisation.create({
        data: {
          name: input.organisationName,
          type: input.organisationType || 'institution',
          createdById: ctx.user.id,
        },
      }))
    // Creator becomes organisation admin
    await db.organisationMember.upsert({
      where: {organisationId_userId: {organisationId: org.id, userId: ctx.user.id}},
      create: {organisationId: org.id, userId: ctx.user.id, role: 'admin', status: 'active'},
      update: {role: 'admin', status: 'active'},
    })
    organisationId = org.id
  }

  const submitting = input.step >= 4

  await db.investorProfile.update({
    where: {userId: ctx.user.id},
    data: {
      onboardingStep: Math.max(input.step, profile.onboardingStep),
      ...(input.classification ? {classification: input.classification} : {}),
      ...(organisationId ? {organisationId} : {}),
      ...(input.jobTitle !== undefined ? {jobTitle: input.jobTitle} : {}),
      ...(input.nationality !== undefined ? {nationality: input.nationality} : {}),
      ...(input.countryResidence !== undefined ? {countryResidence: input.countryResidence} : {}),
      ...(input.phone !== undefined ? {phone: input.phone} : {}),
      ...(input.capitalCurrency ? {capitalCurrency: input.capitalCurrency} : {}),
      ...(input.equityAvailable !== undefined ? {equityAvailable: input.equityAvailable} : {}),
      ...(input.totalCapacity !== undefined ? {totalCapacity: input.totalCapacity} : {}),
      ...(input.capitalFloor !== undefined ? {capitalFloor: input.capitalFloor} : {}),
      ...(input.capitalCeiling !== undefined ? {capitalCeiling: input.capitalCeiling} : {}),
      ...(input.source !== undefined ? {source: input.source} : {}),
      ...(input.objectives !== undefined ? {notes: input.objectives} : {}),
      ...(submitting && profile.verificationStatus === 'email_verified'
        ? {verificationStatus: 'profile_submitted', kycStatus: 'submitted'}
        : {}),
    },
  })

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
