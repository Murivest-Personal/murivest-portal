import type {Metadata} from 'next'
import {supabase, unwrap, toCamelList} from '@/lib/supabase'
import type {OrderRow as OrderDbRow} from '@/lib/db-types'
import {requirePortalUser} from '@/lib/auth/context'
import {getBriefs} from '@/lib/sanity/queries'
import {isSanityConfigured} from '@/lib/sanity/client'
import OrdersWorkspace, {type OrderRow} from '@/components/portal/orders/OrdersWorkspace'

export const metadata: Metadata = {
  title: 'Orders — private & institutional briefs',
  robots: {index: false, follow: false},
}

export const dynamic = 'force-dynamic'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requirePortalUser()
  const sp = await searchParams
  const preselect = typeof sp.opportunity === 'string' ? sp.opportunity : null

  const [briefs, orders] = await Promise.all([
    getBriefs(ctx.effectiveTier),
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', ctx.user.id)
      .order('created_at', {ascending: false})
      .then((res) => toCamelList(unwrap<OrderDbRow[]>(res, 'orders.list'))),
  ])

  const orderRows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    briefTitle: o.briefTitle,
    briefType: o.briefType,
    briefSource: o.briefSource,
    format: o.format,
    status: o.status,
    amountKes: o.amountKes,
    amountUsd: o.amountUsd,
    currency: o.currency,
    paymentMethod: o.paymentMethod,
    transactionId: o.transactionId,
    trackingNumber: o.trackingNumber,
    shippingAddress: o.shippingAddress,
    phone: o.phone,
    contactName: o.contactName,
    contactEmail: o.contactEmail,
    createdAt: o.createdAt,
    deliveredAt: o.deliveredAt ?? null,
    customScope: o.customScope,
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow mb-2">Private &amp; institutional briefs</div>
        <h1 className="font-display text-3xl text-primary lg:text-4xl">Orders</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Order deep institutional research on specific opportunities, off-market properties, auction inventory or custom underwriting packages. Clear scope, transparent pricing, secure payment — and full audit trail from order to delivery.
        </p>
      </div>
      <OrdersWorkspace briefs={briefs} orders={orderRows} sanityConfigured={isSanityConfigured()} preselectOpportunity={preselect} />
    </div>
  )
}
