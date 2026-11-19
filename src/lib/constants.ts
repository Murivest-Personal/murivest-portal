/**
 * Murivest Group constants — company facts as provided by the client brief.
 * Anything environment-specific (M-Pesa paybill, bank wire details) is read
 * from env so the repository never hard-codes financial routing data.
 */

export const COMPANY = {
  legalName: 'Murivest Group Ltd',
  name: 'Murivest Group',
  description:
    'International commercial real estate services and investment firm operating across East Africa, the United Kingdom and other international markets — connecting institutional firms, institutional investors and retail investors to Grade A income-producing commercial assets on a direct, non-pooled, mandate-only basis under fiduciary standards and applicable KYC/AML requirements.',
  phone: '+254 115 277 610',
  email: 'office@murivest.com',
  address: '4th Avenue Parklands, Diamond Plaza, Nairobi',
  additionalOffices: 'Principal offices: Nairobi · London',
  coverage: ['Kenya', 'East Africa', 'United Kingdom', 'International markets'],
  auctionsUrl: 'https://auctions.murivest.com',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://investors.murivest.com',
} as const

export const BRAND = {
  forest: '#1B4332',
  forestDeep: '#0E2A1C',
  ivory: '#FAF9F6',
  gold: '#B8956B',
} as const

/** M-Pesa collection details — configured per environment, never hard-coded. */
export const MPESA = {
  paybill: process.env.NEXT_PUBLIC_MPESA_PAYBILL || process.env.MPESA_PAYBILL || '',
  account: process.env.NEXT_PUBLIC_MPESA_ACCOUNT || process.env.MPESA_ACCOUNT || '',
}

/** Dispositions of engagement shown on the landing page. */
export const ENGAGEMENT_BASIS = [
  'Mandate-only — every engagement proceeds under formally documented scope',
  'Direct, non-pooled asset ownership — no collective investment schemes',
  'Fiduciary standards with applicable KYC/AML verification',
  'Transparent fee structures agreed before any engagement begins',
] as const

export const ASSET_CLASS_OPTIONS = [
  {value: 'office', label: 'Office'},
  {value: 'industrial', label: 'Industrial & logistics'},
  {value: 'retail', label: 'Retail'},
  {value: 'hospitality', label: 'Hospitality'},
  {value: 'mixed_use', label: 'Mixed-use'},
  {value: 'land', label: 'Land & development'},
  {value: 'living', label: 'Living / income residential'},
  {value: 'alternatives', label: 'Alternatives'},
] as const

export const DEAL_STRUCTURE_OPTIONS = [
  {value: 'direct', label: 'Direct acquisition'},
  {value: 'joint_venture', label: 'Joint venture'},
  {value: 'preferred_equity', label: 'Preferred equity'},
  {value: 'debt', label: 'Debt / credit'},
] as const

export const OPPORTUNITY_STATUS_OPTIONS = [
  {value: 'off_market', label: 'Off-market'},
  {value: 'marketed', label: 'Marketed'},
  {value: 'auction', label: 'Auction'},
  {value: 'under_offer', label: 'Under offer'},
  {value: 'closed', label: 'Closed'},
] as const

export const GEO_OPTIONS = [
  {value: 'KE', label: 'Kenya'},
  {value: 'EA', label: 'East Africa'},
  {value: 'UK', label: 'United Kingdom'},
  {value: 'INTL', label: 'International'},
] as const

export const CURRENCY_OPTIONS = [
  {value: 'USD', label: 'USD'},
  {value: 'KES', label: 'KES'},
  {value: 'GBP', label: 'GBP'},
  {value: 'EUR', label: 'EUR'},
] as const

export const NDA_VERSION = process.env.NDA_VERSION || '2025-11'
