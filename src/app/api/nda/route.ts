import {NextResponse, type NextRequest} from 'next/server'
import {supabase, unwrap, unwrapNullable, nowIso, newId} from '@/lib/supabase'
import {NDA_VERSION} from '@/lib/constants'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {clientMeta} from '@/lib/api'
import type {NdaAgreementRow} from '@/lib/db-types'

/** NDA acceptance — unlocks confidential (tier 2/3) material. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const meta = clientMeta(req)

  const existing = unwrapNullable<NdaAgreementRow>(
    await supabase
      .from('nda_agreements')
      .select('*')
      .eq('user_id', ctx.user.id)
      .eq('version', NDA_VERSION)
      .maybeSingle(),
    'ndaAgreements.byUserVersion',
  )
  if (existing) {
    return NextResponse.json({ok: true, alreadyAccepted: true, version: NDA_VERSION})
  }

  // NOTE: sequential (no multi-table tx over PostgREST)
  unwrap<null>(
    await supabase.from('nda_agreements').insert({
      id: newId(),
      user_id: ctx.user.id,
      version: NDA_VERSION,
      ip: meta.ip,
      user_agent: meta.userAgent,
      created_at: nowIso(),
    }),
    'ndaAgreements.create',
  )
  // updated_at is maintained by the DB trigger — not set here.
  unwrap<null>(
    await supabase.from('investor_profiles').update({nda_accepted: true}).eq('user_id', ctx.user.id),
    'investorProfiles.acceptNda',
  )

  await audit({actorId: ctx.user.id, action: 'nda.accepted', entity: 'nda', entityId: NDA_VERSION, detail: {version: NDA_VERSION}, ...meta})
  await notify({
    userId: ctx.user.id,
    type: 'system',
    title: 'Confidentiality agreement recorded',
    body: `NDA (${NDA_VERSION}) accepted. Confidential material is now available to you wherever your verification tier permits.`,
    link: '/portal/documents',
  })
  return NextResponse.json({ok: true, version: NDA_VERSION})
}
