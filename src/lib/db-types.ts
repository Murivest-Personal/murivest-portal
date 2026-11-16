// ============================================================================
// Murivest Private Capital Portal — DB row types
// Auto-derived from sql/001_schema.sql · 004_admin_schema.sql ·
// 006_notifications_schema.sql (production DDL on Supabase, `portal` schema).
// Row shape as returned by the Supabase JS client (snake_case).
// Use toCamel() from '@/lib/supabase' to work in camelCase in app code.
//
// Two exports per model: <Model>Row (snake_case, DB shape) and <Model>
// (camelCase view, replaces the former @prisma/client model types).
// ============================================================================

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Rest}`
  ? `${Head}${SnakeToCamel<Capitalize<Rest>>}`
  : S

/** camelCase view of a snake_case DB row (same value types, renamed keys). */
export type CamelizeRow<T> = {
  [K in keyof T as SnakeToCamel<K & string>]: T[K]
}

/** User — table `users` */
export interface UserRow {
  id: string
  email: string
  password_hash: string
  full_name: string
  role: string
  status: string
  email_verified_at: string
  mfa_enabled: boolean
  mfa_secret_enc: string
  last_login_at: string
  failed_logins: number
  locked_until: string
  created_at: string
  updated_at: string
}
export type User = CamelizeRow<UserRow>

/** Session — table `sessions` */
export interface SessionRow {
  id: string
  user_id: string
  token_hash: string
  user_agent: string
  ip: string
  device: string
  created_at: string
  last_seen_at: string
  expires_at: string
  revoked_at: string
}
export type Session = CamelizeRow<SessionRow>

/** AuthToken — table `auth_tokens` */
export interface AuthTokenRow {
  id: string
  user_id: string
  token_hash: string
  purpose: string
  expires_at: string
  used_at: string
  created_at: string
}
export type AuthToken = CamelizeRow<AuthTokenRow>

/** SecurityEvent — table `security_events` */
export interface SecurityEventRow {
  id: string
  user_id: string
  type: string
  ip: string
  user_agent: string
  detail: Json
  created_at: string
}
export type SecurityEvent = CamelizeRow<SecurityEventRow>

/** Organisation — table `organisations` */
export interface OrganisationRow {
  id: string
  name: string
  legal_name: string
  type: string
  country: string
  website: string
  verified: boolean
  created_by_id: string
  created_at: string
  updated_at: string
}
export type Organisation = CamelizeRow<OrganisationRow>

/** OrganisationMember — table `organisation_members` */
export interface OrganisationMemberRow {
  id: string
  organisation_id: string
  user_id: string
  role: string
  title: string
  status: string
  created_at: string
}
export type OrganisationMember = CamelizeRow<OrganisationMemberRow>

/** InvestorProfile — table `investor_profiles` */
export interface InvestorProfileRow {
  id: string
  user_id: string
  classification: string
  organisation_id: string
  job_title: string
  nationality: string
  country_residence: string
  phone: string
  capital_currency: string
  equity_available: number
  total_capacity: number
  capital_floor: number
  capital_ceiling: number
  verification_status: string
  kyc_status: string
  aml_status: string
  access_tier: string
  nda_accepted: boolean
  onboarding_step: number
  advisor_id: string
  source: string
  notes: string
  preferences: Json
  created_at: string
  updated_at: string
}
export type InvestorProfile = CamelizeRow<InvestorProfileRow>

/** InvestorCriteria — table `investor_criteria` */
export interface InvestorCriteriaRow {
  id: string
  user_id: string
  currency: string
  equity_available: number
  total_capacity: number
  min_ticket: number
  max_ticket: number
  geographies: Json
  asset_classes: Json
  structures: Json
  min_gross_yield: number
  min_net_yield: number
  target_irr: number
  target_cash_on_cash: number
  target_payback_years: number
  hold_period_min: number
  hold_period_max: number
  leverage_comfort: number
  financing_open: boolean
  risk_tolerance: string
  exit_preferences: Json
  currency_note: string
  created_at: string
  updated_at: string
}
export type InvestorCriteria = CamelizeRow<InvestorCriteriaRow>

/** SavedOpportunity — table `saved_opportunities` */
export interface SavedOpportunityRow {
  id: string
  user_id: string
  sanity_id: string
  note: string
  created_at: string
}
export type SavedOpportunity = CamelizeRow<SavedOpportunityRow>

/** OpportunityView — table `opportunity_views` */
export interface OpportunityViewRow {
  id: string
  user_id: string
  sanity_id: string
  viewed_at: string
}
export type OpportunityView = CamelizeRow<OpportunityViewRow>

/** SavedSearch — table `saved_searches` */
export interface SavedSearchRow {
  id: string
  user_id: string
  name: string
  filters: Json
  alert_on_new: boolean
  last_alert_at: string
  created_at: string
}
export type SavedSearch = CamelizeRow<SavedSearchRow>

/** Scenario — table `scenarios` */
export interface ScenarioRow {
  id: string
  user_id: string
  name: string
  sanity_opportunity_id: string
  opportunity_title: string
  inputs: Json
  summary: Json
  notes: string
  created_at: string
  updated_at: string
}
export type Scenario = CamelizeRow<ScenarioRow>

/** Comparison — table `comparisons` */
export interface ComparisonRow {
  id: string
  user_id: string
  name: string
  sanity_ids: Json
  scenario_ids: Json
  snapshot: Json
  created_at: string
  updated_at: string
}
export type Comparison = CamelizeRow<ComparisonRow>

/** Order — table `orders` */
export interface OrderRow {
  id: string
  reference: string
  user_id: string
  brief_source: string
  sanity_brief_id: string
  sanity_opportunity_id: string
  brief_title: string
  brief_type: string
  format: string
  custom_scope: string
  amount_kes: number
  amount_usd: number
  currency: string
  status: string
  payment_method: string
  transaction_id: string
  assigned_to_id: string
  advisor_id: string
  priority: string
  due_at: string
  delivery_document_id: string
  contact_name: string
  contact_email: string
  organisation: string
  shipping_address: string
  phone: string
  delivery_method: string
  tracking_number: string
  cancelled_at: string
  cancellation_reason: string
  delivered_at: string
  closed_at: string
  created_at: string
  updated_at: string
}
export type Order = CamelizeRow<OrderRow>

/** Payment — table `payments` */
export interface PaymentRow {
  id: string
  order_id: string
  user_id: string
  method: string
  amount_kes: number
  amount_usd: number
  currency: string
  reference: string
  confirmation_raw: string
  status: string
  verified_by_id: string
  verified_at: string
  note: string
  created_at: string
}
export type Payment = CamelizeRow<PaymentRow>

/** Mandate — table `mandates` */
export interface MandateRow {
  id: string
  reference: string
  user_id: string
  title: string
  status: string
  description: string
  target_allocation_min: number
  target_allocation_max: number
  currency: string
  geographies: Json
  asset_classes: Json
  structures: Json
  min_net_yield: number
  target_irr: number
  hold_period_min: number
  hold_period_max: number
  leverage_comfort: number
  risk_mandate: string
  exclusions: Json
  advisor_id: string
  stage: string
  probability: number
  next_action: string
  next_action_due: string
  submitted_at: string
  activated_at: string
  closed_at: string
  created_at: string
  updated_at: string
}
export type Mandate = CamelizeRow<MandateRow>

/** MandateMilestone — table `mandate_milestones` */
export interface MandateMilestoneRow {
  id: string
  mandate_id: string
  title: string
  detail: string
  due_date: string
  status: string
  completed_at: string
  created_at: string
}
export type MandateMilestone = CamelizeRow<MandateMilestoneRow>

/** Enquiry — table `enquiries` */
export interface EnquiryRow {
  id: string
  user_id: string
  subject: string
  message: string
  sanity_opportunity_id: string
  opportunity_title: string
  status: string
  created_at: string
  updated_at: string
}
export type Enquiry = CamelizeRow<EnquiryRow>

/** Message — table `messages` */
export interface MessageRow {
  id: string
  user_id: string
  sender_type: string
  sender_id: string
  enquiry_id: string
  body: string
  read_at: string
  created_at: string
}
export type Message = CamelizeRow<MessageRow>

/** Notification — table `notifications` */
export interface NotificationRow {
  id: string
  user_id: string
  category: string
  event: string
  type: string
  priority: string
  title: string
  body: string
  link: string
  payload: Json
  dedupe_key: string
  announcement_id: string
  read_at: string
  created_at: string
}
export type Notification = CamelizeRow<NotificationRow>

/** NotificationSetting — table `notification_settings` */
export interface NotificationSettingRow {
  id: string
  user_id: string
  global_enabled: boolean
  quiet_start_min: number
  quiet_end_min: number
  digest_enabled: boolean
  digest_frequency: string
  email_suppressed: boolean
  created_at: string
  updated_at: string
}
export type NotificationSetting = CamelizeRow<NotificationSettingRow>

/** NotificationPreference — table `notification_preferences` */
export interface NotificationPreferenceRow {
  id: string
  user_id: string
  channel: string
  category: string
  enabled: boolean
  created_at: string
  updated_at: string
}
export type NotificationPreference = CamelizeRow<NotificationPreferenceRow>

/** PushSubscription — table `push_subscriptions` */
export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  platform: string
  user_agent: string
  device_label: string
  last_seen_at: string
  revoked_at: string
  created_at: string
}
export type PushSubscription = CamelizeRow<PushSubscriptionRow>

/** NotificationDelivery — table `notification_deliveries` */
export interface NotificationDeliveryRow {
  id: string
  notification_id: string
  channel: string
  status: string
  address: string
  detail: string
  message_id: string
  sent_at: string
  created_at: string
}
export type NotificationDelivery = CamelizeRow<NotificationDeliveryRow>

/** EmailTemplate — table `email_templates` */
export interface EmailTemplateRow {
  id: string
  key: string
  category: string
  subject: string
  preheader: string
  body_html: string
  body_text: string
  is_active: boolean
  version: number
  updated_by_id: string
  created_at: string
  updated_at: string
}
export type EmailTemplate = CamelizeRow<EmailTemplateRow>

/** EmailTemplateVersion — table `email_template_versions` */
export interface EmailTemplateVersionRow {
  id: string
  template_id: string
  version: number
  subject: string
  preheader: string
  body_html: string
  body_text: string
  saved_by_id: string
  created_at: string
}
export type EmailTemplateVersion = CamelizeRow<EmailTemplateVersionRow>

/** NotificationAnnouncement — table `notification_announcements` */
export interface NotificationAnnouncementRow {
  id: string
  title: string
  body: string
  link: string
  category: string
  priority: string
  audience: Json
  created_by_id: string
  recipient_count: number
  sent_at: string
  created_at: string
}
export type NotificationAnnouncement = CamelizeRow<NotificationAnnouncementRow>

/** DocumentGrant — table `document_grants` */
export interface DocumentGrantRow {
  id: string
  sanity_document_id: string
  user_id: string
  organisation_id: string
  granted_by_id: string
  permission: string
  expires_at: string
  created_at: string
}
export type DocumentGrant = CamelizeRow<DocumentGrantRow>

/** DocumentAccessLog — table `document_access_logs` */
export interface DocumentAccessLogRow {
  id: string
  user_id: string
  sanity_document_id: string
  document_title: string
  action: string
  ip: string
  user_agent: string
  created_at: string
}
export type DocumentAccessLog = CamelizeRow<DocumentAccessLogRow>

/** DocumentRequest — table `document_requests` */
export interface DocumentRequestRow {
  id: string
  user_id: string
  subject: string
  detail: string
  sanity_opportunity_id: string
  type: string
  status: string
  created_at: string
  updated_at: string
}
export type DocumentRequest = CamelizeRow<DocumentRequestRow>

/** NdaAgreement — table `nda_agreements` */
export interface NdaAgreementRow {
  id: string
  user_id: string
  version: string
  ip: string
  user_agent: string
  created_at: string
}
export type NdaAgreement = CamelizeRow<NdaAgreementRow>

/** PortfolioPosition — table `portfolio_positions` */
export interface PortfolioPositionRow {
  id: string
  user_id: string
  name: string
  sanity_opportunity_id: string
  asset_class: string
  geography: string
  status: string
  acquisition_date: string
  purchase_price: number
  currency: string
  equity_deployed: number
  debt_amount: number
  debt_rate: number
  debt_maturity: string
  gross_income_annual: number
  operating_expenses: number
  noi_actual: number
  occupancy_pct: number
  valuation: number
  valuation_date: string
  valuation_basis: string
  notes: string
  created_at: string
  updated_at: string
}
export type PortfolioPosition = CamelizeRow<PortfolioPositionRow>

/** CapitalCall — table `capital_calls` */
export interface CapitalCallRow {
  id: string
  position_id: string
  label: string
  amount: number
  currency: string
  due_date: string
  status: string
  called_at: string
  paid_at: string
  notes: string
  created_at: string
}
export type CapitalCall = CamelizeRow<CapitalCallRow>

/** StaffProfile — table `staff_profiles` */
export interface StaffProfileRow {
  id: string
  user_id: string
  admin_role: string
  title: string
  team: string
  is_active: boolean
  created_at: string
  updated_at: string
}
export type StaffProfile = CamelizeRow<StaffProfileRow>

/** OrderStatusEvent — table `order_status_events` */
export interface OrderStatusEventRow {
  id: string
  order_id: string
  from_status: string
  to_status: string
  changed_by_id: string
  note: string
  created_at: string
}
export type OrderStatusEvent = CamelizeRow<OrderStatusEventRow>

/** RevenueEvent — table `revenue_events` */
export interface RevenueEventRow {
  id: string
  order_id: string
  gross_kes: number
  gross_usd: number
  processing_usd: number
  refund_usd: number
  net_usd: number
  recognised_at: string
  recognised_by_id: string
  note: string
}
export type RevenueEvent = CamelizeRow<RevenueEventRow>

/** RefundAdjustment — table `refund_adjustments` */
export interface RefundAdjustmentRow {
  id: string
  order_id: string
  amount_usd: number
  amount_kes: number
  reason: string
  status: string
  requested_by_id: string
  reviewed_by_id: string
  reviewed_at: string
  created_at: string
}
export type RefundAdjustment = CamelizeRow<RefundAdjustmentRow>

/** ComplianceReview — table `compliance_reviews` */
export interface ComplianceReviewRow {
  id: string
  subject_user_id: string
  reviewer_id: string
  decision: string
  notes: string
  risk_flags: Json
  detail: Json
  created_at: string
}
export type ComplianceReview = CamelizeRow<ComplianceReviewRow>

/** InternalNote — table `internal_notes` */
export interface InternalNoteRow {
  id: string
  entity_type: string
  entity_id: string
  author_id: string
  body: string
  visibility: string
  created_at: string
}
export type InternalNote = CamelizeRow<InternalNoteRow>

/** ContentMeta — table `content_meta` */
export interface ContentMetaRow {
  id: string
  content_type: string
  sanity_id: string
  title: string
  tags: Json
  status: string
  featured: boolean
  visibility_tier: string
  notes: string
  updated_by_id: string
  created_at: string
  updated_at: string
}
export type ContentMeta = CamelizeRow<ContentMetaRow>

/** SystemSetting — table `system_settings` */
export interface SystemSettingRow {
  id: string
  key: string
  category: string
  value: Json
  description: string
  updated_by_id: string
  created_at: string
  updated_at: string
}
export type SystemSetting = CamelizeRow<SystemSettingRow>

/** AuditLog — table `logs` */
export interface AuditLogRow {
  id: string
  actor_id: string
  actor_type: string
  action: string
  entity: string
  entity_id: string
  detail: Json
  ip: string
  user_agent: string
  created_at: string
}
export type AuditLog = CamelizeRow<AuditLogRow>
