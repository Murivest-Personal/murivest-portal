import type {InsightArticle, InsightCategory} from './types'
import {playbooks} from './playbooks'
import {research} from './research'
import {method} from './method'
import {markets} from './markets'

export type {InsightArticle, InsightCategory, InsightBlock, InsightSource} from './types'
export {AUTHOR} from './types'

/** All insight articles — newest first. Static, SEO-indexed, GEO-friendly. */
export const ARTICLES: InsightArticle[] = [...playbooks, ...research, ...method, ...markets].sort(
  (a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0),
)

export const INSIGHT_CATEGORIES: InsightCategory[] = [
  'Billionaire Playbooks',
  'Research & Data',
  'Underwriting Method',
  'Markets & Case Studies',
]

export function articleBySlug(slug: string): InsightArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}

export function articlesByCategory(category: InsightCategory): InsightArticle[] {
  return ARTICLES.filter((a) => a.category === category)
}

export function featuredArticles(): InsightArticle[] {
  return ARTICLES.filter((a) => a.featured)
}

/** Adjacent articles for prev/next navigation, in publication order. */
export function articleNeighbours(slug: string): {prev?: InsightArticle; next?: InsightArticle} {
  const idx = ARTICLES.findIndex((a) => a.slug === slug)
  if (idx < 0) return {}
  return {prev: ARTICLES[idx + 1], next: ARTICLES[idx - 1]}
}

export function readMinutes(article: InsightArticle): number {
  const words = article.blocks.reduce((n, b) => {
    if (b.kind === 'p' || b.kind === 'h3' || b.kind === 'quote') return n + b.text.split(/\s+/).length
    if (b.kind === 'callout') return n + (b.title + ' ' + b.text).split(/\s+/).length
    if (b.kind === 'ul' || b.kind === 'ol') return n + b.items.join(' ').split(/\s+/).length
    if (b.kind === 'table') return n + [b.head.join(' '), ...b.rows.map((r) => r.join(' '))].join(' ').split(/\s+/).length
    return n
  }, 0)
  const faqWords = article.faqs?.reduce((n, f) => n + (f.q + ' ' + f.a).split(/\s+/).length, 0) ?? 0
  return Math.max(3, Math.round((words + faqWords) / 200))
}
