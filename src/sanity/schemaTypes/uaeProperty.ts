import {defineType, defineField} from 'sanity'
import {accessTiers} from './opportunity'

export default defineType({
  name: 'uaeProperty',
  title: 'Property (UAE)',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (r) => r.required().max(120)}),
    defineField({name: 'slug', title: 'Slug', type: 'slug', options: {source: 'title', maxLength: 96}, validation: (r) => r.required()}),
    defineField({name: 'status', title: 'Status', type: 'string', options: {list: [
      {title: 'Available', value: 'available'},
      {title: 'Under Offer', value: 'under_offer'},
      {title: 'Sold', value: 'sold'},
      {title: 'Withdrawn', value: 'withdrawn'},
    ]}, initialValue: 'available', validation: (r) => r.required()}),
    defineField({name: 'accessTier', title: 'Minimum access tier', type: 'string', options: {list: accessTiers}, initialValue: 'tier_1', validation: (r) => r.required()}),
    defineField({name: 'assetClass', title: 'Asset class', type: 'string', options: {list: [
      {title: 'Office', value: 'office'},
      {title: 'Industrial & logistics', value: 'industrial'},
      {title: 'Retail', value: 'retail'},
      {title: 'Hospitality', value: 'hospitality'},
      {title: 'Mixed-use', value: 'mixed_use'},
      {title: 'Land & development', value: 'land'},
      {title: 'Living / residential-income', value: 'living'},
      {title: 'Alternatives', value: 'alternatives'},
    ]}, validation: (r) => r.required()}),
    defineField({
      name: 'geography',
      title: 'Geography',
      type: 'object',
      fields: [
        {name: 'country', title: 'Country', type: 'string', initialValue: 'United Arab Emirates'},
        {name: 'city', title: 'City / market', type: 'string'},
        {name: 'district', title: 'District / submarket', type: 'string'},
        {name: 'addressLine', title: 'Address line (shown to Tier 2+)', type: 'string'},
      ],
    }),
    defineField({name: 'dealStructure', title: 'Deal structure', type: 'string', options: {list: [
      {title: 'Direct acquisition', value: 'direct'},
      {title: 'Joint venture', value: 'joint_venture'},
      {title: 'Preferred equity', value: 'preferred_equity'},
      {title: 'Debt / credit', value: 'debt'},
    ]}}),
    defineField({
      name: 'indicativePrice',
      title: 'Indicative price / pricing guidance',
      type: 'object',
      fields: [
        {name: 'amount', title: 'Amount', type: 'number'},
        {name: 'currency', title: 'Currency (AED / USD)', type: 'string', initialValue: 'AED'},
        {name: 'basis', title: 'Basis (e.g. "asking", "guide", "expressions of interest")', type: 'string'},
      ],
    }),
    defineField({name: 'investmentSizeMin', title: 'Minimum ticket', type: 'number'}),
    defineField({name: 'investmentSizeMax', title: 'Maximum ticket', type: 'number'}),
    defineField({
      name: 'financials',
      title: 'Financial summary (Tier 2+)',
      type: 'object',
      fields: [
        {name: 'grossIncomeAnnual', title: 'Gross income (annual)', type: 'number'},
        {name: 'operatingExpenses', title: 'Operating expenses (annual)', type: 'number'},
        {name: 'noi', title: 'Net operating income (annual)', type: 'number'},
        {name: 'grossYieldPct', title: 'Gross yield %', type: 'number'},
        {name: 'netYieldPct', title: 'Net yield %', type: 'number'},
        {name: 'occupancyPct', title: 'Occupancy %', type: 'number'},
        {name: 'waultYears', title: 'WAULT (years)', type: 'number'},
        {name: 'financialCurrency', title: 'Financial figures currency', type: 'string', initialValue: 'AED'},
      ],
    }),
    defineField({name: 'summary', title: 'Summary (public)', type: 'text', rows: 4, validation: (r) => r.required()}),
    defineField({name: 'description', title: 'Full description', type: 'array', of: [{type: 'block'}]}),
    defineField({name: 'images', title: 'Images', type: 'array', of: [{type: 'image', fields: [{name: 'alt', title: 'Alt text', type: 'string'}]}]}),
    defineField({name: 'documents', title: 'Documents', type: 'array', of: [{type: 'reference', to: [{type: 'documentAsset'}]}]}),
    defineField({name: 'featured', title: 'Featured', type: 'boolean', initialValue: false}),
    defineField({name: 'published', title: 'Published to public site', type: 'boolean', initialValue: false}),
    defineField({name: 'publishDate', title: 'Publish date', type: 'date'}),
    defineField({name: 'linkedOpportunity', title: 'Linked portal opportunity', type: 'reference', to: [{type: 'opportunity'}]}),
  ],
  preview: {
    select: {title: 'title', subtitle: 'geography.city', status: 'status', media: 'images.0'},
    prepare({title, subtitle, status}) {
      return {title, subtitle: [status, subtitle].filter(Boolean).join(' · ')}
    },
  },
})