import {sanityClient} from './client'
import type {OpportunityDoc, BriefDoc, DocumentDoc, MarketReportDoc, LandingContentDoc, AccessTier} from './types'

/**
 * GROQ queries. Every function:
 *  - returns a purposeful empty result when Sanity is not yet configured
 *    (no fabricated sample data, ever);
 *  - takes the acting investor's tier so confidential content is filtered
 *    server-side before it ever reaches the browser.
 */

const OPPORTUNITY_PROJECTION = `{
  _id, title, "slug": slug.current, status, accessTier, assetClass, geography,
  dealStructure, indicativePrice, investmentSizeMin, investmentSizeMax,
  financials, leaseProfile, summary, investmentRationale, keyRisks, auctionUrl,
  featured, publishDate,
  "images": images[] { _key, alt, "ref": asset->_ref },
  "documents": documents[] { _key, _ref },
  "availableBriefs": availableBriefs[] { _key, _ref }
}`

const BRIEF_PROJECTION = `{
  _id, title, "slug": slug.current, briefType, accessTier, scope,
  deliveryExpectations, pricing, auctionRef, description,
  "coverRef": coverImage.asset->_ref,
  "linkedOpportunityId": linkedOpportunity->_id
}`

const DOCUMENT_PROJECTION = `{
  _id, title, docType, accessTier, description, downloadable, publishDate,
  "fileRef": file.asset->_ref,
  "fileExtension": file.asset->extension,
  "fileSize": file.asset->size,
  "linkedOpportunityId": linkedOpportunity->_id
}`

const REPORT_PROJECTION = `{
  _id, title, "slug": slug.current, category, geography, accessTier, summary,
  body, publishDate, "coverRef": coverImage.asset->_ref,
  "attachedDocumentId": attachDocument->_id
}`

export async function getOpportunities(userTier: AccessTier): Promise<OpportunityDoc[]> {
  const client = sanityClient()
  if (!client) return []
  return client.fetch(
    `*[_type == "opportunity" && defined(published) && published == true && accessTier in $tiers] | order(featured desc, publishDate desc, title asc) ${OPPORTUNITY_PROJECTION}`,
    {tiers: tiersAllowedBy(userTier)},
  )
}

export async function getOpportunityById(id: string, userTier: AccessTier): Promise<OpportunityDoc | null> {
  const client = sanityClient()
  if (!client) return null
  return client.fetch(
    `*[_type == "opportunity" && _id == $id && defined(published) && published == true && accessTier in $tiers][0] ${OPPORTUNITY_PROJECTION}`,
    {id, tiers: tiersAllowedBy(userTier)},
  )
}

export async function getBriefs(userTier: AccessTier): Promise<BriefDoc[]> {
  const client = sanityClient()
  if (!client) return []
  return client.fetch(
    `*[_type == "brief" && defined(published) && published == true && accessTier in $tiers] | order(title asc) ${BRIEF_PROJECTION}`,
    {tiers: tiersAllowedBy(userTier)},
  )
}

export async function getBriefById(id: string, userTier: AccessTier): Promise<BriefDoc | null> {
  const client = sanityClient()
  if (!client) return null
  return client.fetch(
    `*[_type == "brief" && _id == $id && defined(published) && published == true && accessTier in $tiers][0] ${BRIEF_PROJECTION}`,
    {id, tiers: tiersAllowedBy(userTier)},
  )
}

export async function getDocuments(userTier: AccessTier): Promise<DocumentDoc[]> {
  const client = sanityClient()
  if (!client) return []
  return client.fetch(
    `*[_type == "document" && defined(published) && published == true && accessTier in $tiers] | order(publishDate desc, title asc) ${DOCUMENT_PROJECTION}`,
    {tiers: tiersAllowedBy(userTier)},
  )
}

export async function getDocumentById(id: string, userTier: AccessTier): Promise<DocumentDoc | null> {
  const client = sanityClient()
  if (!client) return null
  return client.fetch(
    `*[_type == "document" && _id == $id && defined(published) && published == true && accessTier in $tiers][0] ${DOCUMENT_PROJECTION}`,
    {id, tiers: tiersAllowedBy(userTier)},
  )
}

export async function getMarketReports(userTier: AccessTier): Promise<MarketReportDoc[]> {
  const client = sanityClient()
  if (!client) return []
  return client.fetch(
    `*[_type == "marketReport" && defined(published) && published == true && accessTier in $tiers] | order(publishDate desc) ${REPORT_PROJECTION}`,
    {tiers: tiersAllowedBy(userTier)},
  )
}

export async function getMarketReportById(id: string, userTier: AccessTier): Promise<MarketReportDoc | null> {
  const client = sanityClient()
  if (!client) return null
  return client.fetch(
    `*[_type == "marketReport" && _id == $id && defined(published) && published == true && accessTier in $tiers][0] ${REPORT_PROJECTION}`,
    {id, tiers: tiersAllowedBy(userTier)},
  )
}

export async function getLandingContent(): Promise<LandingContentDoc | null> {
  const client = sanityClient()
  if (!client) return null
  return client.fetch(`*[_type == "landingContent"][0] {
    heroEyebrow, heroHeadline, heroSubline, credibility, coverageMarkets,
    "valueProps": valueProps[] { _key, heading, detail }
  }`)
}

/** Resolve a Sanity file asset id to its authenticated URL (server-side only). */
export async function getFileAssetUrl(assetRef: string): Promise<string | null> {
  const client = sanityClient()
  if (!client) return null
  const url = await client.fetch(`*[_type == "sanity.fileAsset" && _id == $ref][0].url`, {ref: assetRef})
  return typeof url === 'string' ? url : null
}

/** Resolve a Sanity image asset id to its CDN URL (server-side only). */
export function getImageAssetUrl(assetRef: string, width?: number): string | null {
  const projectId = process.env.SANITY_PROJECT_ID
  if (!projectId || !assetRef.startsWith('image-')) return null
  const dataset = process.env.SANITY_DATASET || 'production'
  // ref format: image-<id>-<w>x<h>-<ext>
  const m = assetRef.match(/^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/)
  if (!m) return null
  const [, id, , , ext] = m
  const dims = width ? `?w=${width}` : ''
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${id}-${ext}${dims}`
}

function tiersAllowedBy(userTier: AccessTier): AccessTier[] {
  const all: AccessTier[] = ['tier_1', 'tier_2', 'tier_3']
  const rank: Record<AccessTier, number> = {tier_1: 1, tier_2: 2, tier_3: 3}
  return all.filter((t) => rank[t] <= rank[userTier])
}
