import type {MetadataRoute} from 'next'
import {COMPANY} from '@/lib/constants'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = COMPANY.siteUrl.replace(/\/$/, '')
  return [
    {
      url: `${base}/`,
      changeFrequency: 'monthly',
      priority: 1,
      lastModified: new Date(),
    },
  ]
}
