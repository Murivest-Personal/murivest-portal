export type DiscoverSource =
  | 'all'
  | 'off_market'
  | 'auction'
  | 'kenya'
  | 'uk'
  | 'uae'
  | 'singapore'
  | 'us'

export const DISCOVER_SOURCE_OPTIONS: {key: DiscoverSource; label: string}[] = [
  {key: 'all', label: 'All properties'},
  {key: 'off_market', label: 'Off-market'},
  {key: 'auction', label: 'Auction'},
  {key: 'kenya', label: 'Kenya'},
  {key: 'uk', label: 'United Kingdom'},
  {key: 'uae', label: 'United Arab Emirates'},
  {key: 'singapore', label: 'Singapore'},
  {key: 'us', label: 'United States'},
]

export function isDiscoverSource(s: unknown): s is DiscoverSource {
  return typeof s === 'string' && DISCOVER_SOURCE_OPTIONS.some((o) => o.key === s)
}