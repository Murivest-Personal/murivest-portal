import {z} from 'zod'

/**
 * Central validation — mirrors the PostgreSQL CHECK/ENUM constraints in
 * sql/001_schema.sql. Every API route validates input with these schemas
 * before touching the database.
 */

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(320)
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[0-9]/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.')

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: emailSchema,
  password: passwordSchema,
  intent: z.enum(['individual', 'uhnwi', 'institutional_rep']).optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  remember: z.boolean().optional(),
})

export const magicLinkSchema = z.object({email: emailSchema})

export const forgotPasswordSchema = z.object({email: emailSchema})

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
})

export const totpSchema = z.object({code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.')})

export const mfaSetupSchema = z.object({enable: z.boolean()})

// --- Onboarding -----------------------------------------------------------

export const onboardingStepSchema = z.object({
  step: z.number().int().min(1).max(6),
  classification: z.enum(['individual', 'uhnwi', 'institutional_rep']).optional(),
  organisationName: z.string().trim().max(160).optional(),
  organisationType: z.enum(['family_office', 'fund', 'corporate', 'endowment', 'pension', 'institution', 'other']).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  nationality: z.string().trim().max(80).optional(),
  countryResidence: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  capitalCurrency: z.enum(['USD', 'KES', 'GBP', 'EUR']).optional(),
  equityAvailable: z.number().min(0).max(1e12).optional(),
  totalCapacity: z.number().min(0).max(1e12).optional(),
  capitalFloor: z.number().min(0).max(1e12).optional(),
  capitalCeiling: z.number().min(0).max(1e12).optional(),
  objectives: z.string().trim().max(4000).optional(),
  source: z.string().trim().max(200).optional(),
})

// --- Investment criteria ---------------------------------------------------

export const criteriaSchema = z.object({
  currency: z.enum(['USD', 'KES', 'GBP', 'EUR']),
  equityAvailable: z.number().min(0).max(1e12).nullable().optional(),
  totalCapacity: z.number().min(0).max(1e12).nullable().optional(),
  minTicket: z.number().min(0).max(1e12).nullable().optional(),
  maxTicket: z.number().min(0).max(1e12).nullable().optional(),
  geographies: z.array(z.object({country: z.string().max(80), city: z.string().max(80).optional()})).max(20).nullable().optional(),
  assetClasses: z.array(z.enum(['office', 'industrial', 'retail', 'hospitality', 'mixed_use', 'land', 'living', 'alternatives'])).max(8).nullable().optional(),
  structures: z.array(z.enum(['direct', 'joint_venture', 'preferred_equity', 'debt'])).max(4).nullable().optional(),
  minGrossYield: z.number().min(0).max(30).nullable().optional(),
  minNetYield: z.number().min(0).max(30).nullable().optional(),
  targetIrr: z.number().min(0).max(60).nullable().optional(),
  targetCashOnCash: z.number().min(0).max(40).nullable().optional(),
  targetPaybackYears: z.number().min(0).max(50).nullable().optional(),
  holdPeriodMin: z.number().min(0).max(50).nullable().optional(),
  holdPeriodMax: z.number().min(0).max(50).nullable().optional(),
  leverageComfort: z.number().min(0).max(100).nullable().optional(),
  financingOpen: z.boolean().optional(),
  riskTolerance: z.enum(['conservative', 'balanced', 'opportunistic', 'distressed']).nullable().optional(),
  exitPreferences: z.array(z.enum(['hold_for_income', 'timed_sale', 'value_add_exit', 'refinance'])).max(4).nullable().optional(),
})

// --- Scenario --------------------------------------------------------------

export const scenarioInputsSchema = z.object({
  // Acquisition
  price: z.number().min(0).max(1e12),
  currency: z.enum(['USD', 'KES', 'GBP', 'EUR']),
  acquisitionCostsPct: z.number().min(0).max(15),
  // Financing (empty debt => all-cash)
  useDebt: z.boolean(),
  ltvPct: z.number().min(0).max(90),
  interestRatePct: z.number().min(0).max(40),
  termYears: z.number().min(1).max(40),
  amortizationYears: z.number().min(1).max(40),
  ioYears: z.number().min(0).max(10),
  // Income
  grossIncome: z.number().min(0).max(1e12),
  opex: z.number().min(0).max(1e12),
  growthPct: z.number().min(-10).max(30),
  opexGrowthPct: z.number().min(-10).max(30),
  // Exit
  holdYears: z.number().min(1).max(40),
  exitType: z.enum(['hold_for_income', 'timed_sale', 'value_add_exit', 'refinance']),
  exitValueMode: z.enum(['cap_rate', 'exit_value']),
  exitCapRatePct: z.number().min(0).max(25).optional(),
  exitValue: z.number().min(0).max(1e12).optional(),
  exitGrowthPct: z.number().min(-50).max(100),
  sellingCostsPct: z.number().min(0).max(15),
  // Investor equity available (for capital-gap)
  equityAvailable: z.number().min(0).max(1e12),
})

export const scenarioSchema = z.object({
  name: z.string().trim().min(1, 'Name the scenario.').max(120),
  sanityOpportunityId: z.string().max(64).nullable().optional(),
  opportunityTitle: z.string().max(160).nullable().optional(),
  inputs: scenarioInputsSchema,
  notes: z.string().trim().max(2000).nullable().optional(),
})

// --- Mandates --------------------------------------------------------------

export const mandateSchema = z.object({
  title: z.string().trim().min(3, 'Give the mandate a title.').max(140),
  description: z.string().trim().max(4000).optional(),
  targetAllocationMin: z.number().min(0).max(1e12).nullable().optional(),
  targetAllocationMax: z.number().min(0).max(1e12).nullable().optional(),
  currency: z.enum(['USD', 'KES', 'GBP', 'EUR']),
  geographies: z.array(z.object({country: z.string().max(80), city: z.string().max(80).optional()})).max(20).nullable().optional(),
  assetClasses: z.array(z.string().max(40)).max(8).nullable().optional(),
  structures: z.array(z.string().max(40)).max(4).nullable().optional(),
  minNetYield: z.number().min(0).max(30).nullable().optional(),
  targetIrr: z.number().min(0).max(60).nullable().optional(),
  holdPeriodMin: z.number().min(0).max(50).nullable().optional(),
  holdPeriodMax: z.number().min(0).max(50).nullable().optional(),
  leverageComfort: z.number().min(0).max(100).nullable().optional(),
  riskMandate: z.enum(['conservative', 'balanced', 'opportunistic']).nullable().optional(),
  exclusions: z.array(z.string().max(200)).max(20).nullable().optional(),
})

// --- Orders & payments -----------------------------------------------------

export const orderSchema = z.object({
  sanityBriefId: z.string().max(64).nullable().optional(),
  briefTitle: z.string().max(200),
  briefType: z.enum(['private_brief', 'institutional_brief', 'custom']),
  briefSource: z.enum(['catalog', 'auction', 'off_market', 'custom']),
  sanityOpportunityId: z.string().max(64).nullable().optional(),
  format: z.enum(['digital', 'hard_copy']),
  customScope: z.string().trim().max(4000).nullable().optional(),
  amountKes: z.number().min(0).max(1e9),
  amountUsd: z.number().min(0).max(1e9),
  currency: z.enum(['KES', 'USD']),
  paymentMethod: z.enum(['mpesa', 'wire', 'card', 'paypal']).nullable().optional(),
  shippingAddress: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
})

export const mpesaConfirmationSchema = z.object({
  orderId: z.string().min(5).max(64),
  mpesaMessage: z.string().trim().min(10, 'Paste the full M-Pesa confirmation message.').max(1000),
})

export const wireConfirmationSchema = z.object({
  orderId: z.string().min(5).max(64),
  bankReference: z.string().trim().min(4).max(120),
})

export const paypalConfirmationSchema = z.object({
  orderId: z.string().min(5).max(64),
  paypalEmail: z.string().email().optional(),
})

// --- Communications --------------------------------------------------------

export const enquirySchema = z.object({
  subject: z.string().trim().min(3, 'Add a subject.').max(200),
  message: z.string().trim().min(10, 'Add a message.').max(4000),
  sanityOpportunityId: z.string().max(64).nullable().optional(),
  opportunityTitle: z.string().max(160).nullable().optional(),
})

export const messageSchema = z.object({
  enquiryId: z.string().max(64).nullable().optional(),
  body: z.string().trim().min(1).max(4000),
})

export const documentRequestSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  detail: z.string().trim().max(4000).optional(),
  type: z.enum(['data_room', 'report', 'model', 'legal', 'custom']),
  sanityOpportunityId: z.string().max(64).nullable().optional(),
})

// --- Portfolio -------------------------------------------------------------

export const positionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sanityOpportunityId: z.string().max(64).nullable().optional(),
  assetClass: z.string().max(60).nullable().optional(),
  geography: z.string().max(120).nullable().optional(),
  status: z.enum(['committed', 'held', 'exited']),
  acquisitionDate: z.string().datetime().nullable().optional(),
  purchasePrice: z.number().min(0).max(1e12).nullable().optional(),
  currency: z.enum(['USD', 'KES', 'GBP', 'EUR']),
  equityDeployed: z.number().min(0).max(1e12).nullable().optional(),
  debtAmount: z.number().min(0).max(1e12).nullable().optional(),
  debtRate: z.number().min(0).max(40).nullable().optional(),
  debtMaturity: z.string().datetime().nullable().optional(),
  grossIncomeAnnual: z.number().min(0).max(1e12).nullable().optional(),
  operatingExpenses: z.number().min(0).max(1e12).nullable().optional(),
  noiActual: z.number().min(0).max(1e12).nullable().optional(),
  occupancyPct: z.number().min(0).max(100).nullable().optional(),
  valuation: z.number().min(0).max(1e12).nullable().optional(),
  valuationDate: z.string().datetime().nullable().optional(),
  valuationBasis: z.enum(['independent_valuation', 'appraisal', 'manager_estimate']).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
})

export const capitalCallSchema = z.object({
  positionId: z.string().min(5).max(64),
  label: z.string().trim().min(1).max(160),
  amount: z.number().min(0).max(1e12),
  currency: z.enum(['USD', 'KES', 'GBP', 'EUR']),
  dueDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

// --- Profile & security ----------------------------------------------------

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  nationality: z.string().trim().max(80).nullable().optional(),
  countryResidence: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  capitalCurrency: z.enum(['USD', 'KES', 'GBP', 'EUR']).optional(),
  equityAvailable: z.number().min(0).max(1e12).nullable().optional(),
  totalCapacity: z.number().min(0).max(1e12).nullable().optional(),
  capitalFloor: z.number().min(0).max(1e12).nullable().optional(),
  capitalCeiling: z.number().min(0).max(1e12).nullable().optional(),
  notifyOrders: z.boolean().optional(),
  notifyMatches: z.boolean().optional(),
  notifyDocuments: z.boolean().optional(),
  notifyMessages: z.boolean().optional(),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
})

export const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  filters: z.record(z.string(), z.unknown()),
  alertOnNew: z.boolean().optional(),
})

export type ScenarioInputs = z.infer<typeof scenarioInputsSchema>
export type CriteriaInput = z.infer<typeof criteriaSchema>
export type MandateInput = z.infer<typeof mandateSchema>
export type OrderInput = z.infer<typeof orderSchema>
export type PositionInput = z.infer<typeof positionSchema>
