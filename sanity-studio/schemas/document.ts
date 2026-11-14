import {defineType, defineField} from 'sanity'
import {accessTiers} from './opportunity'

/**
 * Secure data-room document. Files upload here; the portal streams them
 * through its own permission-checked, access-logged route — direct asset
 * URLs are never exposed to investors.
 */
export default defineType({
  name: 'document',
  title: 'Data-room Document',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (r) => r.required()}),
    defineField({
      name: 'docType',
      title: 'Document type',
      type: 'string',
      options: {
        list: [
          {title: 'Investment memorandum', value: 'investment_memo'},
          {title: 'Due-diligence pack', value: 'dd_pack'},
          {title: 'Financial model', value: 'financial_model'},
          {title: 'Legal document', value: 'legal'},
          {title: 'Report', value: 'report'},
          {title: 'Other', value: 'other'},
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({name: 'accessTier', title: 'Minimum access tier', type: 'string', options: {list: accessTiers}, initialValue: 'tier_2', validation: (r) => r.required()}),
    defineField({name: 'file', title: 'File', type: 'file', validation: (r) => r.required()}),
    defineField({name: 'description', title: 'Description', type: 'text', rows: 2}),
    defineField({name: 'linkedOpportunity', title: 'Related opportunity', type: 'reference', to: [{type: 'opportunity'}]}),
    defineField({name: 'downloadable', title: 'Downloadable (unchecked = in-portal preview only)', type: 'boolean', initialValue: false}),
    defineField({name: 'published', title: 'Published to data room', type: 'boolean', initialValue: false}),
    defineField({name: 'publishDate', title: 'Publish date', type: 'datetime'}),
  ],
  preview: {
    select: {title: 'title', docType: 'docType', tier: 'accessTier'},
    prepare({title, docType, tier}) {
      return {title, subtitle: [docType, tier].filter(Boolean).join(' · ')}
    },
  },
})
