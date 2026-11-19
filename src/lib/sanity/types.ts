/**
 * TypeScript projections of the Sanity content types defined in
 * sanity-studio/schemas/. The portal renders "not disclosed" for any
 * financial field left empty by the editorial team — never a placeholder
 * number.
 */

export type AccessTier = 'tier_1' | 'tier_2' | 'tier_3'
export type DiscoverDocumentType =
  | 'opportunity'
  | 'auctionProperty'
  | 'property'
  | 'ukProperty'
  | 'uaeProperty'
  | 'sgProperty'
  | 'usProperty'

export interface SanityImage {
  _key?: string
  asset?: {_ref: string}
  alt?: string
}

export interface OpportunityFinancials {
  grossIncomeAnnual?: number | null
  operatingExpenses?: number | null
  noi?: number | null
  grossYieldPct?: number | null
  netYieldPct?: number | null
  occupancyPct?: number | null
  waultYears?: number | null
  financialCurrency?: string | null
}

export interface LeaseLine {
  _key: string
  tenant?: string | null
  area?: string | null
  expires?: string | null
  income?: number | null
}

export interface OpportunityDoc {
  _id: string
  _type: DiscoverDocumentType
  title: string
  slug?: {current?: string} | null
  status: 'off_market' | 'marketed' | 'auction' | 'under_offer' | 'closed'
  listingType?: 'off_market' | 'auction' | 'available_by_country' | null
  country?: string | null
  publicDetailUrl?: string | null
  sanityProjectId?: string | null
  sanityDataset?: string | null
  accessTier: AccessTier
  assetClass?: string | null
  geography?: {
    country?: string | null
    city?: string | null
    district?: string | null
    addressLine?: string | null
  } | null
  dealStructure?: string | null
  indicativePrice?: {
    amount?: number | null
    currency?: string | null
    basis?: string | null
    display?: string | null
  } | null
  investmentSizeMin?: number | null
  investmentSizeMax?: number | null
  financials?: OpportunityFinancials | null
  leaseProfile?: LeaseLine[] | null
  summary?: string | null
  investmentRationale?: unknown[] | null
  keyRisks?: string[] | null
  auctionUrl?: string | null
  images?: SanityImage[] | null
  documents?: {_key: string; _ref: string}[] | null
  featured?: boolean | null
  isOffMarket?: boolean | null
  availableBriefs?: {_key: string; _ref: string}[] | null
  publishDate?: string | null
  kycBuyerForm?: KYCBuyerForm | null
}

export interface BeneficialOwner {
  name?: string | null
  idPassport?: string | null
}

export interface KYCIndividualDetails {
  fullName?: string | null
  idPassportNumber?: string | null
  nationality?: string | null
  dateOfBirth?: string | null
  kraPin?: string | null
  phoneNumber?: string | null
  emailAddress?: string | null
  currentResidentialAddress?: string | null
  postalAddress?: string | null
}

export interface KYCCompanyDetails {
  companyName?: string | null
  registrationNumber?: string | null
  dateOfIncorporation?: string | null
  countryOfIncorporation?: string | null
  registeredOfficeAddress?: string | null
  companyKraPin?: string | null
  contactPerson?: string | null
  designation?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  directors?: string[] | null
}

export interface KYCTransactionDetails {
  propertyDescription?: string | null
  assetType?: string | null
  estimatedPurchasePrice?: string | null
  modeOfFinancing?: string | null
  financingOther?: string | null
  intendedUse?: string | null
  intendedUseOther?: string | null
}

export interface KYCSourceOfFunds {
  sourceOfFundsDetail?: string | null
  bankStatementsAttached?: boolean | null
  loanApprovalLetterAttached?: boolean | null
  saleAgreementAttached?: boolean | null
  otherSupportingDocumentsAttached?: boolean | null
}

export interface KYCDeclarations {
  isPep?: string | null
  pepDetails?: string | null
  beneficialOwners?: BeneficialOwner[] | null
  consent?: string | null
  signedBy?: string | null
  signedDate?: string | null
  capacity?: string | null
}

export interface KYCDocumentsToAttach {
  idPassportCopy?: boolean | null
  certificateOfIncorporation?: boolean | null
  kraPinDoc?: boolean | null
  cr12?: boolean | null
  proofOfAddress?: boolean | null
  companyKraPinDoc?: boolean | null
  passportPhotos?: boolean | null
  boardResolution?: boolean | null
  sourceOfFundsDocs?: boolean | null
  directorsIdsPins?: boolean | null
  beneficialOwnershipForm?: boolean | null
}

export interface KYCBuyerForm {
  buyerType?: string | null
  individual?: KYCIndividualDetails | null
  company?: KYCCompanyDetails | null
  transaction?: KYCTransactionDetails | null
  sourceOfFunds?: KYCSourceOfFunds | null
  declarations?: KYCDeclarations | null
  documents?: KYCDocumentsToAttach | null
}

export interface BriefPricing {
  digitalKes?: number | null
  digitalUsd?: number | null
  hardKes?: number | null
  hardUsd?: number | null
  hardCopyAvailable?: boolean | null
  notes?: string | null
}

export interface BriefDoc {
  _id: string
  _type: 'brief'
  title: string
  slug?: {current?: string} | null
  briefType: 'private_brief' | 'institutional_brief'
  accessTier: AccessTier
  scope?: unknown[] | null
  deliveryExpectations?: string | null
  pricing?: BriefPricing | null
  linkedOpportunity?: {_ref: string} | null
  /** GROQ projection: linkedOpportunity->_id (flat). */
  linkedOpportunityId?: string | null
  auctionRef?: string | null
  coverImage?: SanityImage | null
  description?: string | null
}

export interface DocumentDoc {
  _id: string
  _type: 'document'
  title: string
  docType: 'investment_memo' | 'dd_pack' | 'financial_model' | 'legal' | 'report' | 'other'
  accessTier: AccessTier
  file?: {_ref?: string} | null
  description?: string | null
  linkedOpportunity?: {_ref: string} | null
  downloadable?: boolean | null
  publishDate?: string | null
  /** GROQ projections (lib/sanity/queries.ts): file.asset->_ref / ->extension / ->size, linkedOpportunity->_id. */
  fileRef?: string | null
  fileExtension?: string | null
  fileSize?: number | null
  linkedOpportunityId?: string | null
}

export interface MarketReportDoc {
  _id: string
  _type: 'marketReport'
  title: string
  slug?: {current?: string} | null
  category: 'market_report' | 'country_insight' | 'sector_insight' | 'trend' | 'economic_indicator' | 'commentary'
  geography?: string | null
  accessTier: AccessTier
  summary?: string | null
  body?: unknown[] | null
  coverImage?: SanityImage | null
  attachDocument?: {_ref: string} | null
  /** GROQ projection: attachDocument->_id (flat). */
  attachedDocumentId?: string | null
  publishDate?: string | null
}

export interface LandingContentDoc {
  _type: 'landingContent'
  heroEyebrow?: string | null
  heroHeadline?: string | null
  heroSubline?: string | null
  valueProps?: {heading?: string; detail?: string; _key: string}[] | null
  credibility?: string[] | null
  coverageMarkets?: string[] | null
  directorName?: string | null
  directorVideoUrl?: string | null
  directorVideoPosterRef?: string | null
  directorVideoCaption?: string | null
}

/** Tier rank helper — a user of tier N may read documents requiring tier ≤ N. */
const TIER_RANK: Record<AccessTier, number> = {tier_1: 1, tier_2: 2, tier_3: 3}

export function tierAllows(userTier: AccessTier, requiredTier: AccessTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier]
}
