/** Insight article content model — statically rendered, SEO/GEO-optimised. */

export type InsightCategory = 'Billionaire Playbooks' | 'Research & Data' | 'Underwriting Method' | 'Markets & Case Studies'

export type InsightBlock =
  | {kind: 'p'; text: string}
  | {kind: 'h3'; text: string}
  | {kind: 'ul'; items: string[]}
  | {kind: 'ol'; items: string[]}
  | {kind: 'quote'; text: string; cite?: string}
  | {kind: 'callout'; title: string; text: string}
  | {kind: 'table'; caption?: string; head: string[]; rows: string[][]}

export interface InsightSource {
  outlet: string
  title: string
  url: string
}

export interface InsightArticle {
  slug: string
  title: string
  /** Standfirst / meta description (150–170 chars target). */
  dek: string
  category: InsightCategory
  tags: string[]
  author: {name: 'Mark Muriithi'; role: 'Managing Director · Differential Underwriter'}
  publishedAt: string
  updatedAt: string
  featured?: boolean
  sources: InsightSource[]
  blocks: InsightBlock[]
  faqs?: {q: string; a: string}[]
}

export const AUTHOR = {
  name: 'Mark Muriithi',
  role: 'Managing Director · Differential Underwriter',
  bio:
    'Mark Muriithi is the Managing Director of Murivest Group Ltd and the originator of Differential Underwriting — the house method that ranks a deal\u2019s competing explanations of value, tests the assumptions that move the answer, rules out the stories that fail, and prices the spread between consensus and reality.',
} as const
