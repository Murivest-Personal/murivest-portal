import {defineType, defineField} from 'sanity'
import {accessTiers} from './opportunity'

/**
 * Market Intelligence articles — curated research, country and sector
 * insights, trend analysis and Murivest commentary. High-signal only.
 */
export default defineType({
  name: 'marketReport',
  title: 'Market Intelligence',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'slug', title: 'Slug', type: 'slug', options: {source: 'title', maxLength: 96}, validation: (r) => r.required()}),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          {title: 'Market report', value: 'market_report'},
          {title: 'Country insight', value: 'country_insight'},
          {title: 'Sector insight', value: 'sector_insight'},
          {title: 'Trend analysis', value: 'trend'},
          {title: 'Economic indicator', value: 'economic_indicator'},
          {title: 'Murivest commentary', value: 'commentary'},
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({name: 'geography', title: 'Geography (e.g. Kenya, Nairobi, UK, London)', type: 'string'}),
    defineField({name: 'accessTier', title: 'Minimum access tier', type: 'string', options: {list: accessTiers}, initialValue: 'tier_1', validation: (r) => r.required()}),
    defineField({name: 'summary', title: 'Summary (card text)', type: 'text', rows: 3, validation: (r) => r.required()}),
    defineField({name: 'body', title: 'Body', type: 'array', of: [{type: 'block'}]}),
    defineField({name: 'coverImage', title: 'Cover image', type: 'image', fields: [{name: 'alt', title: 'Alt text', type: 'string'}]}),
    defineField({name: 'attachDocument', title: 'Attached document (optional)', type: 'reference', to: [{type: 'document'}]}),
    defineField({name: 'publishDate', title: 'Publish date', type: 'date', validation: (r) => r.required()}),
    defineField({name: 'published', title: 'Published', type: 'boolean', initialValue: false}),
  ],
  preview: {
    select: {title: 'title', category: 'category', geography: 'geography'},
    prepare({title, category, geography}) {
      return {title, subtitle: [category, geography].filter(Boolean).join(' · ')}
    },
  },
})
