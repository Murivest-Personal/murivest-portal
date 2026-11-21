import type {MetadataRoute} from 'next'
import {ARTICLES} from '@/components/content/insights'
import {COMPANY} from '@/lib/constants'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = COMPANY.siteUrl.replace(/\/$/, '')

  const staticRoutes: MetadataRoute.Sitemap = [
    {url: `${base}/`, changeFrequency: 'monthly', priority: 1, lastModified: new Date()},
    {
      url: `${base}/differential-underwriting`,
      changeFrequency: 'monthly',
      priority: 0.9,
      lastModified: new Date(),
    },
    {
      url: `${base}/underwriting-calculator`,
      changeFrequency: 'monthly',
      priority: 0.9,
      lastModified: new Date(),
    },
    {url: `${base}/billionaire-real-estate`, changeFrequency: 'monthly', priority: 0.8, lastModified: new Date()},
    {url: `${base}/insights`, changeFrequency: 'weekly', priority: 0.8, lastModified: new Date()},
  ]

  const articleRoutes: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${base}/insights/${a.slug}`,
    changeFrequency: 'monthly' as const,
    priority: a.featured ? 0.7 : 0.6,
    lastModified: new Date(a.updatedAt),
  }))

  return [...staticRoutes, ...articleRoutes]
}
