import {defineType, defineField} from 'sanity'

/**
 * Access tiers — must match portal access tiers exactly:
 *   tier_1 = email-verified investors (public marketing fields only)
 *   tier_2 = KYC-verified UHNWI / institutional (financials + off-market)
 *   tier_3 = fully verified institutional (everything)
 */
export const accessTiers = [
  {title: 'Tier 1 — Verified investors', value: 'tier_1'},
  {title: 'Tier 2 — KYC-verified UHNWI / institutional', value: 'tier_2'},
  {title: 'Tier 3 — Fully verified institutional', value: 'tier_3'},
]

export const opportunityStatuses = [
  {title: 'Off-market', value: 'off_market'},
  {title: 'Marketed', value: 'marketed'},
  {title: 'Auction', value: 'auction'},
  {title: 'Under offer', value: 'under_offer'},
  {title: 'Closed', value: 'closed'},
]

export const dealStructures = [
  {title: 'Direct acquisition', value: 'direct'},
  {title: 'Joint venture', value: 'joint_venture'},
  {title: 'Preferred equity', value: 'preferred_equity'},
  {title: 'Debt / credit', value: 'debt'},
]

export const assetClasses = [
  {title: 'Office', value: 'office'},
  {title: 'Industrial & logistics', value: 'industrial'},
  {title: 'Retail', value: 'retail'},
  {title: 'Hospitality', value: 'hospitality'},
  {title: 'Mixed-use', value: 'mixed_use'},
  {title: 'Land & development', value: 'land'},
  {title: 'Living / residential-income', value: 'living'},
  {title: 'Alternatives (student, data, medical)', value: 'alternatives'},
]

export default defineType({
  name: 'opportunity',
  title: 'Opportunity',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (r) => r.required().max(120)}),
    defineField({name: 'slug', title: 'Slug', type: 'slug', options: {source: 'title', maxLength: 96}, validation: (r) => r.required()}),
    defineField({name: 'status', title: 'Status', type: 'string', options: {list: opportunityStatuses, layout: 'radio'}, initialValue: 'marketed', validation: (r) => r.required()}),
    defineField({
      name: 'accessTier',
      title: 'Minimum access tier',
      description: 'Who may see this listing at all. Financial detail fields below carry their own tier gating.',
      type: 'string',
      options: {list: accessTiers},
      initialValue: 'tier_1',
      validation: (r) => r.required(),
    }),
    defineField({name: 'assetClass', title: 'Asset class', type: 'string', options: {list: assetClasses}, validation: (r) => r.required()}),
    defineField({
      name: 'geography',
      title: 'Geography',
      type: 'object',
      fields: [
        {name: 'country', title: 'Country', type: 'string'},
        {name: 'city', title: 'City / market', type: 'string'},
        {name: 'district', title: 'District / submarket', type: 'string'},
        {name: 'addressLine', title: 'Address line (shown to Tier 2+)', type: 'string'},
      ],
    }),
    defineField({name: 'dealStructure', title: 'Deal structure', type: 'string', options: {list: dealStructures}}),
    defineField({
      name: 'indicativePrice',
      title: 'Indicative price / pricing guidance',
      type: 'object',
      fields: [
        {name: 'amount', title: 'Amount', type: 'number'},
        {name: 'currency', title: 'Currency (USD / KES / GBP / EUR)', type: 'string', initialValue: 'USD'},
        {name: 'basis', title: 'Basis (e.g. “asking”, “guide”, “expressions of interest”)', type: 'string'},
      ],
    }),
    defineField({name: 'investmentSizeMin', title: 'Minimum ticket (same currency)', type: 'number'}),
    defineField({name: 'investmentSizeMax', title: 'Maximum ticket', type: 'number'}),
    defineField({
      name: 'financials',
      title: 'Financial summary (Tier 2+)',
      description: 'Institutional underwriting summary. Leave a field empty rather than estimating — the portal never invents figures.',
      type: 'object',
      fields: [
        {name: 'grossIncomeAnnual', title: 'Gross income (annual, property currency)', type: 'number'},
        {name: 'operatingExpenses', title: 'Operating expenses (annual)', type: 'number'},
        {name: 'noi', title: 'Net operating income (annual)', type: 'number'},
        {name: 'grossYieldPct', title: 'Gross yield %', type: 'number'},
        {name: 'netYieldPct', title: 'Net yield %', type: 'number'},
        {name: 'occupancyPct', title: 'Occupancy %', type: 'number'},
        {name: 'waultYears', title: 'WAULT (years)', type: 'number'},
        {name: 'financialCurrency', title: 'Financial figures currency', type: 'string', initialValue: 'USD'},
      ],
    }),
    defineField({
      name: 'leaseProfile',
      title: 'Lease profile (Tier 2+)',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'tenant', title: 'Tenant', type: 'string'},
            {name: 'area', title: 'Area / share', type: 'string'},
            {name: 'expires', title: 'Lease expiry', type: 'string'},
            {name: 'income', title: 'Annual income (property currency)', type: 'number'},
          ],
          preview: {select: {title: 'tenant', subtitle: 'area'}},
        },
      ],
    }),
    defineField({name: 'summary', title: 'Summary (Tier 1 visible)', type: 'text', rows: 4, validation: (r) => r.required()}),
    defineField({name: 'investmentRationale', title: 'Investment rationale (Tier 2+)', type: 'array', of: [{type: 'block'}]}),
    defineField({name: 'keyRisks', title: 'Key risks & considerations (Tier 2+)', type: 'array', of: [{type: 'string'}]}),
    defineField({name: 'auctionUrl', title: 'Auction listing URL (auctions.murivest.com)', type: 'url'}),
    defineField({name: 'images', title: 'Images', type: 'array', of: [{type: 'image', fields: [{name: 'alt', title: 'Alt text', type: 'string'}]}]}),
    defineField({name: 'documents', title: 'Data-room documents (referenced)', type: 'array', of: [{type: 'reference', to: [{type: 'document'}]}]}),
    defineField({name: 'featured', title: 'Featured in Discover', type: 'boolean', initialValue: false}),
    defineField({name: 'availableBriefs', title: 'Orderable briefs for this opportunity', type: 'array', of: [{type: 'reference', to: [{type: 'brief'}]}]}),
    defineField({name: 'publishDate', title: 'Publish date', type: 'date'}),
    defineField({name: 'published', title: 'Published to portal', type: 'boolean', initialValue: false}),
  ],
  orderings: [
    {
      title: 'Status, then title',
      name: 'statusTitle',
      by: [{field: 'status', direction: 'asc'}, {field: 'title', direction: 'asc'}],
    },
  ],
  preview: {
    select: {title: 'title', subtitle: 'geography.city', status: 'status', media: 'images.0'},
    prepare({title, subtitle, status}) {
      return {title, subtitle: [status, subtitle].filter(Boolean).join(' · ')}
    },
  },
})
