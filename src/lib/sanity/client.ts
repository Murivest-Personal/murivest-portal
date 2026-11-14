import {createClient, type SanityClient} from '@sanity/client'

/**
 * Server-only Sanity client.
 *
 * - All Sanity access in the portal happens on the server (RSC / route
 *   handlers) so the read token for private datasets never reaches the
 *   browser.
 * - When SANITY_PROJECT_ID is not configured the portal serves purposeful
 *   empty states ("content awaiting publication") — it never fabricates
 *   sample data.
 */

let cached: SanityClient | null | undefined

export function sanityClient(): SanityClient | null {
  if (cached !== undefined) return cached
  const projectId = process.env.SANITY_PROJECT_ID
  if (!projectId || projectId === 'your-project-id') {
    cached = null
    return cached
  }
  cached = createClient({
    projectId,
    dataset: process.env.SANITY_DATASET || 'production',
    apiVersion: process.env.SANITY_API_VERSION || '2025-01-01',
    useCdn: process.env.SANITY_USE_CDN === 'true', // institutional data: default to fresh reads
    token: process.env.SANITY_API_READ_TOKEN || undefined,
    perspective: 'published',
    studioUrl: process.env.SANITY_STUDIO_URL || undefined,
  })
  return cached
}

export function isSanityConfigured(): boolean {
  return sanityClient() !== null
}
