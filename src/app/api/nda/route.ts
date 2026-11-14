import {NextResponse, type NextRequest} from 'next/server'
import {db} from '@/lib/db'
import {NDA_VERSION} from '@/lib/constants'
import {audit, notify} from '@/lib/auth/audit'
import {requireApiUser, isResponse} from '@/lib/auth/context'
import {clientMeta} from '@/lib/api'

/** NDA acceptance — unlocks confidential (tier 2/3) material. */
export async function POST(req: NextRequest) {
  const guard = await requireApiUser()
  if (isResponse(guard)) return guard.response
  const {ctx} = guard
  const meta = clientMeta(req)

  const existing = await db.ndaAgreement.findUnique({
    where: {userId_version: {userId: ctx.user.id, version: NDA_VERSION}},
  })
  if (existing) {
    return NextResponse.json({ok: true, alreadyAccepted: true, version: NDA_VERSION})
  }

  await db.ndaAgreement.create({data: {userId: ctx.user.id, version: NDA_VERSION, ip: meta.ip, userAgent: meta.userAgent}})
  await db.investorProfile.update({where: {userId: ctx.user.id}, data: {ndaAccepted: true}})

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
