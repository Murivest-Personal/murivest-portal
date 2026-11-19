import {defineType, defineField} from 'sanity'

/**
 * Access tiers — must match portal access tiers exactly:
 *   tier_1 = email-verified investors (public marketing fields only)
 *   tier_2 = KYC-verified UHNWI / institutional (financials + off-market)
 *   tier_3 = fully verified institutional (everything)
 */
export const accessTiers = [
  {title: 'Tier 1 — Verified investors', value: 'tier_1'},
  {title: 'Tier 2 — KYC-verified UHNWI / institutional', value: 'tier_2'},
  {title: 'Tier 3 — Fully verified institutional', value: 'tier_3'},
]

export const opportunityStatuses = [
  {title: 'Off-market', value: 'off_market'},
  {title: 'Marketed', value: 'marketed'},
  {title: 'Auction', value: 'auction'},
  {title: 'Under offer', value: 'under_offer'},
  {title: 'Closed', value: 'closed'},
]

export const listingTypes = [
  {title: 'Off-market (Portal only)', value: 'off_market'},
  {title: 'Auction', value: 'auction'},
  {title: 'Available by Country', value: 'available_by_country'},
]

export const dealStructures = [
  {title: 'Direct acquisition', value: 'direct'},
  {title: 'Joint venture', value: 'joint_venture'},
  {title: 'Preferred equity', value: 'preferred_equity'},
  {title: 'Debt / credit', value: 'debt'},
]

export const assetClasses = [
  {title: 'Office', value: 'office'},
  {title: 'Industrial & logistics', value: 'industrial'},
  {title: 'Retail', value: 'retail'},
  {title: 'Hospitality', value: 'hospitality'},
  {title: 'Mixed-use', value: 'mixed_use'},
  {title: 'Land & development', value: 'land'},
  {title: 'Living / residential-income', value: 'living'},
  {title: 'Alternatives (student, data, medical)', value: 'alternatives'},
]

export const countries = [
  {title: 'Kenya', value: 'kenya'},
  {title: 'United Kingdom', value: 'uk'},
  {title: 'United Arab Emirates', value: 'uae'},
  {title: 'Singapore', value: 'singapore'},
  {title: 'United States', value: 'us'},

]

export default defineType({
  name: 'opportunity',
  title: 'Opportunity',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (r) => r.required().max(120)}),
    defineField({name: 'slug', title: 'Slug', type: 'slug', options: {source: 'title', maxLength: 96}, validation: (r) => r.required()}),
    defineField({
      name: 'listingType',
      title: 'Listing Type',
      description: 'Controls where and how this property appears. Off-market = portal only. Auction = auction section. Available by Country = public listings filtered by investor country.',
      type: 'string',
      options: {list: listingTypes, layout: 'radio'},
      initialValue: 'available_by_country',
      validation: (r) => r.required(),
    }),
    defineField({name: 'status', title: 'Status', type: 'string', options: {list: opportunityStatuses, layout: 'radio'}, initialValue: 'marketed', validation: (r) => r.required()}),
    defineField({
      name: 'accessTier',
      title: 'Minimum access tier',
      description: 'Who may see this listing at all. Financial detail fields below carry their own tier gating.',
      type: 'string',
      options: {list: accessTiers},
      initialValue: 'tier_1',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'country',
      title: 'Country',
      description: 'Primary country for filtering. Investors see properties matching their country.',
      type: 'string',
      options: {list: countries},
      validation: (r) => r.required(),
    }),
    defineField({name: 'assetClass', title: 'Asset class', type: 'string', options: {list: assetClasses}, validation: (r) => r.required()}),
    defineField({
      name: 'geography',
      title: 'Geography Details',
      type: 'object',
      fields: [
        {name: 'city', title: 'City / market', type: 'string'},
        {name: 'district', title: 'District / submarket', type: 'string'},
        {name: 'addressLine', title: 'Address line (shown to Tier 2+)', type: 'string'},
      ],
    }),
    defineField({name: 'dealStructure', title: 'Deal structure', type: 'string', options: {list: dealStructures}}),
    defineField({
      name: 'indicativePrice',
      title: 'Indicative price / pricing guidance',
      type: 'object',
      fields: [
        {name: 'amount', title: 'Amount', type: 'number'},
        {name: 'currency', title: 'Currency (USD / KES / GBP / EUR)', type: 'string', initialValue: 'USD'},
        {name: 'basis', title: 'Basis (e.g. "asking", "guide", "expressions of interest")', type: 'string'},
      ],
    }),
    defineField({name: 'investmentSizeMin', title: 'Minimum ticket (same currency)', type: 'number'}),
    defineField({name: 'investmentSizeMax', title: 'Maximum ticket', type: 'number'}),
    defineField({
      name: 'publicDetailUrl',
      title: 'Public Site Detail URL',
      description: 'Link to property detail page on public marketing site. Leave blank for off-market properties (portal only). Used for "Available by Country" and "Auction" listing types.',
      type: 'url',
      hidden: ({parent}) => parent?.listingType === 'off_market',
    }),
    defineField({
      name: 'sanityProjectId',
      title: 'Sanity Project ID',
      description: 'If this property\'s documents/images are in a different Sanity project, enter that project ID here. Leave blank for main project.',
      type: 'string',
    }),
    defineField({
      name: 'sanityDataset',
      title: 'Sanity Dataset',
      description: 'Dataset name for the external Sanity project (usually "production").',
      type: 'string',
      hidden: ({parent}) => !parent?.sanityProjectId,
    }),
    defineField({
      name: 'financials',
      title: 'Financial summary (Tier 2+)',
      description: 'Institutional underwriting summary. Leave a field empty rather than estimating — the portal never invents figures.',
      type: 'object',
      fields: [
        {name: 'grossIncomeAnnual', title: 'Gross income (annual, property currency)', type: 'number'},
        {name: 'operatingExpenses', title: 'Operating expenses (annual)', type: 'number'},
        {name: 'noi', title: 'Net operating income (annual)', type: 'number'},
        {name: 'grossYieldPct', title: 'Gross yield %', type: 'number'},
        {name: 'netYieldPct', title: 'Net yield %', type: 'number'},
        {name: 'occupancyPct', title: 'Occupancy %', type: 'number'},
        {name: 'waultYears', title: 'WAULT (years)', type: 'number'},
        {name: 'financialCurrency', title: 'Financial figures currency', type: 'string', initialValue: 'USD'},
      ],
    }),
    defineField({
      name: 'leaseProfile',
      title: 'Lease profile (Tier 2+)',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'tenant', title: 'Tenant', type: 'string'},
            {name: 'area', title: 'Area / share', type: 'string'},
            {name: 'expires', title: 'Lease expiry', type: 'string'},
            {name: 'income', title: 'Annual income (property currency)', type: 'number'},
          ],
          preview: {select: {title: 'tenant', subtitle: 'area'}},
        },
      ],
    }),
    defineField({name: 'summary', title: 'Summary (Tier 1 visible)', type: 'text', rows: 4, validation: (r) => r.required()}),
    defineField({name: 'investmentRationale', title: 'Investment rationale (Tier 2+)', type: 'array', of: [{type: 'block'}]}),
    defineField({name: 'keyRisks', title: 'Key risks & considerations (Tier 2+)', type: 'array', of: [{type: 'string'}]}),
    defineField({name: 'auctionUrl', title: 'Auction listing URL (auctions.murivest.com)', type: 'url'}),
    defineField({name: 'images', title: 'Images', type: 'array', of: [{type: 'image', fields: [{name: 'alt', title: 'Alt text', type: 'string'}]}]}),
    defineField({name: 'documents', title: 'Data-room documents (referenced)', type: 'array', of: [{type: 'reference', to: [{type: 'documentAsset'}]}]}),
    defineField({name: 'featured', title: 'Featured in Discover', type: 'boolean', initialValue: false}),
    defineField({name: 'availableBriefs', title: 'Orderable briefs for this opportunity', type: 'array', of: [{type: 'reference', to: [{type: 'brief'}]}]}),
    defineField({name: 'publishDate', title: 'Publish date', type: 'date'}),
    defineField({name: 'published', title: 'Published to portal', type: 'boolean', initialValue: false}),
    /* ---------- KYC buyer information form (per investor interest) ---------- */
    defineField({
      name: 'kycBuyerForm',
      title: 'KYC Buyer Information Form',
      type: 'object',
      description: 'Buyer due-diligence form captured when an investor expresses interest in this property. Downloadable as a PDF from the admin KYC / compliance area.',
      fields: [
        defineField({
          name: 'buyerType',
          title: 'Type of Buyer',
          type: 'string',
          options: {
            list: [
              {title: 'Individual', value: 'individual'},
              {title: 'Company / Corporate Entity', value: 'company'},
              {title: 'Other', value: 'other'},
            ],
            layout: 'radio',
          },
          validation: (r) => r.required(),
        }),
        defineField({
          name: 'individual',
          title: 'Individual Buyer Details',
          type: 'object',
          description: 'Completed when buyer type is Individual.',
          fields: [
            defineField({name: 'fullName', title: 'Full Name', type: 'string'}),
            defineField({name: 'idPassportNumber', title: 'ID / Passport Number', type: 'string'}),
            defineField({name: 'nationality', title: 'Nationality', type: 'string'}),
            defineField({name: 'dateOfBirth', title: 'Date of Birth', type: 'date'}),
            defineField({name: 'kraPin', title: 'KRA PIN', type: 'string'}),
            defineField({name: 'phoneNumber', title: 'Phone Number', type: 'string'}),
            defineField({name: 'emailAddress', title: 'Email Address', type: 'email'}),
            defineField({name: 'currentResidentialAddress', title: 'Current Residential Address', type: 'text', rows: 2}),
            defineField({name: 'postalAddress', title: 'Postal Address (if different)', type: 'text', rows: 2}),
          ],
        }),
        defineField({
          name: 'company',
          title: 'Company / Entity Buyer Details',
          type: 'object',
          description: 'Completed when buyer type is Company / Corporate Entity.',
          fields: [
            defineField({name: 'companyName', title: 'Company Name', type: 'string'}),
            defineField({name: 'registrationNumber', title: 'Registration Number', type: 'string'}),
            defineField({name: 'dateOfIncorporation', title: 'Date of Incorporation', type: 'date'}),
            defineField({name: 'countryOfIncorporation', title: 'Country of Incorporation', type: 'string'}),
            defineField({name: 'registeredOfficeAddress', title: 'Registered Office Address', type: 'text', rows: 2}),
            defineField({name: 'companyKraPin', title: 'KRA PIN (Company)', type: 'string'}),
            defineField({name: 'contactPerson', title: 'Contact Person', type: 'string'}),
            defineField({name: 'designation', title: 'Designation', type: 'string'}),
            defineField({name: 'contactEmail', title: 'Contact Email', type: 'email'}),
            defineField({name: 'contactPhone', title: 'Contact Phone', type: 'string'}),
            defineField({
              name: 'directors',
              title: 'Names of Directors',
              type: 'array',
              of: [{type: 'string'}],
              validation: (r) => r.min(1),
            }),
          ],
        }),
        defineField({
          name: 'transaction',
          title: 'Transaction Details',
          type: 'object',
          fields: [
            defineField({name: 'propertyDescription', title: 'Property Description / Location', type: 'text', rows: 2}),
            defineField({
              name: 'assetType',
              title: 'Type of Asset',
              type: 'string',
              options: {
                list: [
                  {title: 'Hotel', value: 'hotel'},
                  {title: 'Commercial', value: 'commercial'},
                  {title: 'Residential', value: 'residential'},
                  {title: 'Land', value: 'land'},
                ],
              },
            }),
            defineField({name: 'estimatedPurchasePrice', title: 'Estimated Purchase Price (KES)', type: 'string'}),
            defineField({
              name: 'modeOfFinancing',
              title: 'Mode of Financing',
              type: 'string',
              options: {
                list: [
                  {title: 'Own Funds', value: 'own_funds'},
                  {title: 'Loan / Mortgage', value: 'loan_mortgage'},
                  {title: 'Other', value: 'other'},
                ],
                layout: 'radio',
              },
            }),
            defineField({name: 'financingOther', title: 'Other Financing (explain)', type: 'text', rows: 2}),
            defineField({
              name: 'intendedUse',
              title: 'Intended Use of Property',
              type: 'string',
              options: {
                list: [
                  {title: 'Hotel Operation', value: 'hotel_operation'},
                  {title: 'Redevelopment', value: 'redevelopment'},
                  {title: 'Investment Rental', value: 'investment_rental'},
                  {title: 'Other', value: 'other'},
                ],
              },
            }),
            defineField({name: 'intendedUseOther', title: 'Other Intended Use', type: 'text', rows: 2}),
          ],
        }),
        defineField({
          name: 'sourceOfFunds',
          title: 'Source of Funds Declaration',
          type: 'object',
          fields: [
            defineField({name: 'sourceOfFundsDetail', title: 'Origin of Funds', type: 'text', rows: 3, description: 'Please briefly describe the origin of funds intended for the purchase.'}),
            defineField({name: 'bankStatementsAttached', title: 'Bank Statements Attached', type: 'boolean', initialValue: false}),
            defineField({name: 'loanApprovalLetterAttached', title: 'Loan Approval Letter Attached', type: 'boolean', initialValue: false}),
            defineField({name: 'saleAgreementAttached', title: 'Sale Agreement from Prior Asset Attached', type: 'boolean', initialValue: false}),
            defineField({name: 'otherSupportingDocumentsAttached', title: 'Other Supporting Documents Attached', type: 'boolean', initialValue: false}),
          ],
        }),
        defineField({
          name: 'declarations',
          title: 'Declarations & Consents',
          type: 'object',
          fields: [
            defineField({
              name: 'isPep',
              title: 'Politically Exposed Person (PEP)',
              type: 'string',
              options: {list: [{title: 'Yes', value: 'yes'}, {title: 'No', value: 'no'}], layout: 'radio'},
            }),
            defineField({name: 'pepDetails', title: 'PEP Details (if yes)', type: 'text', rows: 3}),
            defineField({
              name: 'beneficialOwners',
              title: 'Beneficial Owners (companies — >10% ownership)',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    defineField({name: 'name', title: 'Name', type: 'string'}),
                    defineField({name: 'idPassport', title: 'ID / Passport', type: 'string'}),
                  ],
                },
              ],
            }),
            defineField({
              name: 'consent',
              title: 'Consent & Declaration',
              type: 'string',
              options: {list: [{title: 'I confirm the information provided is accurate and complete.', value: 'accepted'}]},
              validation: (r) => r.required(),
            }),
            defineField({name: 'signedBy', title: 'Signed By', type: 'string'}),
            defineField({name: 'signedDate', title: 'Date', type: 'date'}),
            defineField({name: 'capacity', title: 'Capacity (if company)', type: 'string'}),
          ],
        }),
        defineField({
          name: 'documents',
          title: 'Documents to Attach',
          type: 'object',
          fields: [
            defineField({name: 'idPassportCopy', title: 'ID / Passport copy', type: 'boolean', initialValue: false}),
            defineField({name: 'certificateOfIncorporation', title: 'Certificate of Incorporation', type: 'boolean', initialValue: false}),
            defineField({name: 'kraPinDoc', title: 'KRA PIN', type: 'boolean', initialValue: false}),
            defineField({name: 'cr12', title: 'CR12', type: 'boolean', initialValue: false}),
            defineField({name: 'proofOfAddress', title: 'Proof of address', type: 'boolean', initialValue: false}),
            defineField({name: 'companyKraPinDoc', title: 'Company KRA PIN', type: 'boolean', initialValue: false}),
            defineField({name: 'passportPhotos', title: '2x passport photos', type: 'boolean', initialValue: false}),
            defineField({name: 'boardResolution', title: 'Board resolution to purchase', type: 'boolean', initialValue: false}),
            defineField({name: 'sourceOfFundsDocs', title: 'Source of funds docs', type: 'boolean', initialValue: false}),
            defineField({name: 'directorsIdsPins', title: "Directors' IDs + PINs", type: 'boolean', initialValue: false}),
            defineField({name: 'beneficialOwnershipForm', title: 'Beneficial Ownership form', type: 'boolean', initialValue: false}),
          ],
        }),
      ],
    }),
  ],
  orderings: [
    {
      title: 'Listing Type, Country, then Title',
      name: 'listingTypeCountryTitle',
      by: [
        {field: 'listingType', direction: 'asc'},
        {field: 'country', direction: 'asc'},
        {field: 'title', direction: 'asc'},
      ],
    },
    {
      title: 'Country, then Title',
      name: 'countryTitle',
      by: [{field: 'country', direction: 'asc'}, {field: 'title', direction: 'asc'}],
    },
    {
      title: 'Status, then Title',
      name: 'statusTitle',
      by: [{field: 'status', direction: 'asc'}, {field: 'title', direction: 'asc'}],
    },
  ],
  preview: {
    select: {title: 'title', subtitle: 'geography.city', status: 'status', listingType: 'listingType', country: 'country', media: 'images.0'},
    prepare({title, subtitle, status, listingType, country}) {
      const typeLabel = listingType === 'off_market' ? '🔒 Off-market' : listingType === 'auction' ? '🔨 Auction' : '🌍 Available'
      const countryLabel = country ? country.toUpperCase() : ''
      return {title, subtitle: [typeLabel, countryLabel, status, subtitle].filter(Boolean).join(' · ')}
    },
  },
})