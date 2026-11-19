import {type NextRequest} from 'next/server'
import {requireAdminApi, isAdminResponse} from '@/lib/admin/rbac'
import {getAdminOpportunityById} from '@/lib/admin/queries'
import {generateKycFormPdf} from '@/lib/pdf/kyc-form'
import {fail} from '@/lib/api'

/**
 * Admin KYC form PDF download.
 * GET /api/admin/kyc-form?sanityId=<id>
 *
 * Generates a downloadable PDF of the KYC buyer information form for a
 * property. Requires the compliance.view permission.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi('compliance.view')
  if (isAdminResponse(guard)) return guard.response
  const {actx} = guard

  const sp = new URL(req.url).searchParams
  const sanityId = sp.get('sanityId') ?? ''
  if (!sanityId) return fail('sanityId is required.', 400)

  const op = await getAdminOpportunityById(sanityId)
  if (!op) return fail('Property not found.', 404)

  const form = op.kycBuyerForm ?? null
  const pdfBytes = await generateKycFormPdf({
    propertyTitle: op.title,
    propertyLocation: op.geography?.city ?? op.geography?.addressLine ?? null,
    propertyReference: op.title,
    form,
    generatedAt: new Date().toISOString().slice(0, 10),
  })

  const safeTitle = op.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="murivest-kyc-${safeTitle}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
