import {NextResponse, type NextRequest} from 'next/server'
import {z} from 'zod'
import {supabase, unwrap, unwrapNullable, toCamel} from '@/lib/supabase'
import {profileUpdateSchema} from '@/lib/validation'
import {audit} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {parseBody, fail, clientMeta} from '@/lib/api'
import type {InvestorProfileRow} from '@/lib/db-types'

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

  const data: Record<string, unknown> = {
    ...(input.jobTitle !== undefined ? {job_title: input.jobTitle} : {}),
    ...(input.nationality !== undefined ? {nationality: input.nationality} : {}),
    ...(input.countryResidence !== undefined ? {country_residence: input.countryResidence} : {}),
    ...(input.phone !== undefined ? {phone: input.phone} : {}),
    ...(input.capitalCurrency ? {capital_currency: input.capitalCurrency} : {}),
    ...(input.equityAvailable !== undefined ? {equity_available: input.equityAvailable} : {}),
    ...(input.totalCapacity !== undefined ? {total_capacity: input.totalCapacity} : {}),
    ...(input.capitalFloor !== undefined ? {capital_floor: input.capitalFloor} : {}),
    ...(input.capitalCeiling !== undefined ? {capital_ceiling: input.capitalCeiling} : {}),
  }
  // updated_at is maintained by the DB trigger — not set here.
  const profileRow = unwrap<InvestorProfileRow>(
    await supabase
      .from('investor_profiles')
      .update(data)
      .eq('user_id', ctx.user.id)
      .select('*')
      .single(),
    'investorProfiles.update',
  )
  const profile = toCamel(profileRow)
  if (input.fullName !== undefined) {
    unwrap<null>(
      await supabase.from('users').update({full_name: input.fullName}).eq('id', ctx.user.id),
      'users.updateFullName',
    )
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

  const profileRow = unwrapNullable<InvestorProfileRow>(
    await supabase.from('investor_profiles').select('*').eq('user_id', guard.ctx.user.id).maybeSingle(),
    'investorProfiles.getForPrefs',
  )
  const current = (profileRow?.preferences as Record<string, boolean> | null) ?? {}
  const merged = {...current, ...parsed.data}
  // updated_at is maintained by the DB trigger — not set here.
  unwrap<null>(
    await supabase.from('investor_profiles').update({preferences: merged}).eq('user_id', guard.ctx.user.id),
    'investorProfiles.updatePrefs',
  )
  return NextResponse.json({ok: true, preferences: merged})
}
