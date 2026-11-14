import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {db} from '@/lib/db'
import {profileUpdateSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'

const prefSchema = z.object({
  notifyOrders: z.boolean().optional(),
  notifyMatches: z.boolean().optional(),
  notifyDocuments: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
})

/** PATCH — investor profile fields. */
export async function PATCH(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const parsed = await parseBody(req, profileUpdateSchema)
  if ('response' in parsed) return parsed.response
  const input = parsed.data

  const profile = await db.investorProfile.update({
    where: {userId: ctx.user.id},
    data: {
      ...(input.jobTitle !== undefined ? {jobTitle: input.jobTitle} : {}),
      ...(input.nationality !== undefined ? {nationality: input.nationality} : {}),
      ...(input.countryResidence !== undefined ? {countryResidence: input.countryResidence} : {}),
      ...(input.phone !== undefined ? {phone: input.phone} : {}),
      ...(input.capitalCurrency ? {capitalCurrency: input.capitalCurrency} : {}),
      ...(input.equityAvailable !== undefined ? {equityAvailable: input.equityAvailable} : {}),
      ...(input.totalCapacity !== undefined ? {totalCapacity: input.totalCapacity} : {}),
      ...(input.capitalFloor !== undefined ? {capitalFloor: input.capitalFloor} : {}),
      ...(input.capitalCeiling !== undefined ? {capitalCeiling: input.capitalCeiling} : {}),
    },
  })
  if (input.fullName !== undefined) {
    await db.user.update({where: {id: ctx.user.id}, data: {fullName: input.fullName}})
  }

  await audit({actorId: ctx.user.id, action: 'profile.updated', entity: 'profile', entityId: profile.id, ...clientMeta(req)})
  return NextResponse.json({ok: true})
}

/** POST — communication preferences. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const parsed = prefSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail('Invalid preferences.')

  const profile = await db.investorProfile.findUnique({where: {userId: guard.ctx.user.id}})
  const current = (profile?.preferences as Record<string, boolean> | null) ?? {}
  const merged = {...current, ...parsed.data}
  await db.investorProfile.update({where: {userId: guard.ctx.user.id}, data: {preferences: merged as never}})
  return NextResponse.json({ok: true, preferences: merged})
}
