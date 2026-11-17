import {defineType, defineField} from 'sanity'

/**
 * Landing page content singleton — keeps the public surface's copy
 * under editorial control without redeploying the application.
 */
export default defineType({
  name: 'landingContent',
  title: 'Landing Page Content',
  type: 'document',
  fields: [
    defineField({name: 'heroEyebrow', title: 'Hero eyebrow', type: 'string', initialValue: 'Murivest Group · Private Capital'}),
    defineField({name: 'heroHeadline', title: 'Hero headline', type: 'string'}),
    defineField({name: 'heroSubline', title: 'Hero sub-headline', type: 'text', rows: 3}),
    defineField({
      name: 'valueProps',
      title: 'Value propositions',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'heading', title: 'Heading', type: 'string'},
            {name: 'detail', title: 'Detail', type: 'text', rows: 2},
          ],
          preview: {select: {title: 'heading'}},
        },
      ],
    }),
    defineField({
      name: 'credibility',
      title: 'Credibility signals (institutional, no consumer testimonials)',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'coverageMarkets',
      title: 'Coverage markets',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'directorName',
      title: 'Director name (video + signature)',
      description: 'Full name shown under the Director letter signature and on the video card.',
      type: 'string',
    }),
    defineField({
      name: 'directorVideoUrl',
      title: 'Director introduction video URL',
      description: 'Direct mp4/webm URL (e.g. a CDN link or an uploaded file field). Overrides NEXT_PUBLIC_DIRECTOR_VIDEO_URL.',
      type: 'url',
    }),
    defineField({
      name: 'directorVideoPoster',
      title: 'Director video poster frame',
      description: 'Still image shown before play. Overrides NEXT_PUBLIC_DIRECTOR_VIDEO_POSTER.',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'directorVideoCaption',
      title: 'Director video caption line',
      description: 'e.g. "Recorded at 4th Avenue Parklands, Nairobi."',
      type: 'string',
    }),
  ],
  preview: {
    select: {title: 'heroHeadline'},
    prepare({title}) {
      return {title: title || 'Landing content', subtitle: 'Singleton — edit, do not create duplicates'}
    },
  },
})