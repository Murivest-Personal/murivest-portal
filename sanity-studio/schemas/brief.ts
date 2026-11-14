import {defineType, defineField} from 'sanity'
import {accessTiers} from './opportunity'

/**
 * Private / Institutional brief products orderable from the portal's
 * Orders module. Prices are set here per brief — the portal never hard-codes
 * prices and never invents catalogue content.
 */
export default defineType({
  name: 'brief',
  title: 'Investment Brief (orderable)',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (r) => r.required().max(140)}),
    defineField({name: 'slug', title: 'Slug', type: 'slug', options: {source: 'title', maxLength: 96}, validation: (r) => r.required()}),
    defineField({
      name: 'briefType',
      title: 'Brief type',
      type: 'string',
      options: {
        list: [
          {title: 'Private brief (single opportunity)', value: 'private_brief'},
          {title: 'Institutional investment brief', value: 'institutional_brief'},
        ],
        layout: 'radio',
      },
      initialValue: 'private_brief',
      validation: (r) => r.required(),
    }),
    defineField({name: 'accessTier', title: 'Minimum access tier to order', type: 'string', options: {list: accessTiers}, initialValue: 'tier_1', validation: (r) => r.required()}),
    defineField({name: 'scope', title: 'Scope of work (what the brief contains)', type: 'array', of: [{type: 'block'}]}),
    defineField({name: 'deliveryExpectations', title: 'Delivery expectations', type: 'text', rows: 3, description: 'e.g. “Delivered to your secure Document Room within 10 working days of payment confirmation.”'}),
    defineField({
      name: 'pricing',
      title: 'Pricing',
      type: 'object',
      fields: [
        {name: 'digitalKes', title: 'Digital edition — price (KES)', type: 'number', initialValue: 0},
        {name: 'digitalUsd', title: 'Digital edition — price (USD)', type: 'number', initialValue: 0},
        {name: 'hardKes', title: 'Hard copy — price (KES, courier included)', type: 'number'},
        {name: 'hardUsd', title: 'Hard copy — price (USD)', type: 'number'},
        {name: 'hardCopyAvailable', title: 'Hard copy available', type: 'boolean', initialValue: true},
        {name: 'notes', title: 'Pricing notes', type: 'string'},
      ],
    }),
    defineField({name: 'linkedOpportunity', title: 'Related opportunity', type: 'reference', to: [{type: 'opportunity'}]}),
    defineField({name: 'auctionRef', title: 'Auction reference (auctions.murivest.com)', type: 'string'}),
    defineField({name: 'coverImage', title: 'Cover image', type: 'image', fields: [{name: 'alt', title: 'Alt text', type: 'string'}]}),
    defineField({name: 'description', title: 'Short description (catalogue card)', type: 'text', rows: 3}),
    defineField({name: 'published', title: 'Published to portal catalogue', type: 'boolean', initialValue: false}),
  ],
  preview: {
    select: {title: 'title', briefType: 'briefType', digitalKes: 'pricing.digitalKes'},
    prepare({title, briefType, digitalKes}) {
      const typeLabel = briefType === 'institutional_brief' ? 'Institutional' : 'Private'
      const price = typeof digitalKes === 'number' ? (digitalKes > 0 ? `KES ${digitalKes.toLocaleString()}` : 'Complimentary') : ''
      return {title, subtitle: [typeLabel, price].filter(Boolean).join(' · ')}
    },
  },
})
