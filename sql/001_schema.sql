-- =============================================================================
-- MURIVEST PRIVATE CAPITAL PORTAL — 001_schema.sql
-- Production PostgreSQL schema (PostgreSQL 14+; Supabase-compatible).
--
-- Creates every table backing each interaction with the portal:
--   • authentication (users, sessions, tokens, security events)
--   • organisations & membership
--   • investor profiles, verification pipeline & criteria
--   • interaction with Sanity-sourced content (saved / viewed opportunities,
--     saved searches)
--   • Investment Studio (scenarios, comparisons)
--   • Orders & payments (private / institutional briefs)
--   • Mandates & milestones
--   • Communications (enquiries, messages, notifications)
--   • Secure data room (document grants, access logs, requests, NDA)
--   • Portfolio & capital calls
--   • Audit trail
--
-- Content itself (opportunities, briefs, documents, market reports) is
-- authored in Sanity and fetched via GROQ; local tables reference content
-- by Sanity document id (`sanity_*` columns).
--
-- Ids are TEXT (cuid generated application-side). Apply with psql:
--   psql "$DIRECT_URL" -f sql/001_schema.sql
--   psql "$DIRECT_URL" -f sql/002_rls.sql
--   psql "$DIRECT_URL" -f sql/003_functions.sql
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS portal;
CREATE SCHEMA IF NOT EXISTS audit;

-- -----------------------------------------------------------------------------
-- Enumerated domains (mirrored app-side by zod validation in src/lib/validation.ts)
-- -----------------------------------------------------------------------------
CREATE TYPE portal.user_role          AS ENUM ('investor','advisor','admin');
CREATE TYPE portal.account_status      AS ENUM ('active','suspended','locked');

CREATE TYPE portal.classification     AS ENUM ('individual','uhnwi','institutional_rep');
CREATE TYPE portal.verification_status AS ENUM ('unverified','email_verified','profile_submitted','kyc_pending','in_review','verified','rejected');
CREATE TYPE portal.kyc_status         AS ENUM ('not_started','submitted','in_review','approved','rejected');
CREATE TYPE portal.aml_status          AS ENUM ('not_started','clear','flagged');
CREATE TYPE portal.access_tier         AS ENUM ('tier_1','tier_2','tier_3');
CREATE TYPE portal.risk_tolerance      AS ENUM ('conservative','balanced','opportunistic','distressed');

CREATE TYPE portal.token_purpose       AS ENUM ('email_verify','magic_link','password_reset');
CREATE TYPE portal.security_event_type AS ENUM ('login','login_failed','logout','new_device','mfa_enabled','mfa_disabled','password_changed','session_revoked','account_locked');

CREATE TYPE portal.org_type            AS ENUM ('family_office','fund','corporate','endowment','pension','institution','other');
CREATE TYPE portal.org_member_role     AS ENUM ('admin','member','analyst');
CREATE TYPE portal.org_member_status  AS ENUM ('invited','active','removed');

CREATE TYPE portal.order_source        AS ENUM ('catalog','auction','off_market','custom');
CREATE TYPE portal.order_type          AS ENUM ('private_brief','institutional_brief','custom');
CREATE TYPE portal.order_format       AS ENUM ('digital','hard_copy');
CREATE TYPE portal.order_status        AS ENUM ('pending','awaiting_payment','payment_confirmed','processing','ready','delivered','cancelled');
CREATE TYPE portal.payment_method     AS ENUM ('mpesa','wire','card');
CREATE TYPE portal.payment_status     AS ENUM ('submitted','verified','rejected','failed');

CREATE TYPE portal.mandate_status      AS ENUM ('draft','submitted','active','paused','closed','rejected');
CREATE TYPE portal.milestone_status    AS ENUM ('pending','in_progress','done','blocked');

CREATE TYPE portal.enquiry_status      AS ENUM ('open','responded','closed');
CREATE TYPE portal.message_sender     AS ENUM ('investor','advisor','system');

CREATE TYPE portal.notification_type   AS ENUM ('order_status','message','mandate','document','match','security','system');

CREATE TYPE portal.doc_permission     AS ENUM ('view','download');
CREATE TYPE portal.doc_request_type    AS ENUM ('data_room','report','model','legal','custom');
CREATE TYPE portal.doc_request_status  AS ENUM ('submitted','in_review','ready','declined');
CREATE TYPE portal.doc_access_action   AS ENUM ('view','download','request');

CREATE TYPE portal.position_status     AS ENUM ('committed','held','exited');
CREATE TYPE portal.capital_call_status AS ENUM ('scheduled','called','paid','waived');
CREATE TYPE portal.actor_type          AS ENUM ('user','advisor','admin','system');

-- -----------------------------------------------------------------------------
-- Authentication & identity
-- -----------------------------------------------------------------------------
CREATE TABLE portal.users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT,                          -- scrypt; NULL => magic-link/SSO-only
  full_name         TEXT,
  role              portal.user_role       NOT NULL DEFAULT 'investor',
  status            portal.account_status  NOT NULL DEFAULT 'active',
  email_verified_at TIMESTAMPTZ,
  mfa_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_enc    TEXT,                          -- AES-256-GCM encrypted TOTP secret
  last_login_at     TIMESTAMPTZ,
  failed_logins     INTEGER NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_users_role_idx ON portal.users (role);

CREATE TABLE portal.sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,                -- sha-256 of opaque cookie token
  user_agent  TEXT,
  ip          INET,
  device      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX portal_sessions_user_idx ON portal.sessions (user_id, last_seen_at);

CREATE TABLE portal.auth_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose    portal.token_purpose NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_auth_tokens_user_idx ON portal.auth_tokens (user_id, purpose);

CREATE TABLE portal.security_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES portal.users(id) ON DELETE CASCADE,
  type       portal.security_event_type NOT NULL,
  ip         INET,
  user_agent TEXT,
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_security_events_user_idx ON portal.security_events (user_id, created_at);

-- -----------------------------------------------------------------------------
-- Organisations
-- -----------------------------------------------------------------------------
CREATE TABLE portal.organisations (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  legal_name   TEXT,
  type         portal.org_type NOT NULL DEFAULT 'institution',
  country      TEXT,
  website      TEXT,
  verified     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_id TEXT NOT NULL REFERENCES portal.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, type)
);

CREATE TABLE portal.organisation_members (
  id              TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL REFERENCES portal.organisations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  role            portal.org_member_role NOT NULL DEFAULT 'member',
  title           TEXT,
  status          portal.org_member_status NOT NULL DEFAULT 'invited',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Investor profile & criteria
-- -----------------------------------------------------------------------------
CREATE TABLE portal.investor_profiles (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL UNIQUE REFERENCES portal.users(id) ON DELETE CASCADE,
  classification     portal.classification NOT NULL DEFAULT 'individual',
  organisation_id    TEXT REFERENCES portal.organisations(id),
  job_title          TEXT,
  nationality        TEXT,
  country_residence  TEXT,
  phone              TEXT,
  capital_currency   TEXT NOT NULL DEFAULT 'USD',
  equity_available  NUMERIC(18,2),
  total_capacity     NUMERIC(18,2),
  capital_floor      NUMERIC(18,2),
  capital_ceiling    NUMERIC(18,2),
  verification_status portal.verification_status NOT NULL DEFAULT 'unverified',
  kyc_status         portal.kyc_status  NOT NULL DEFAULT 'not_started',
  aml_status         portal.aml_status NOT NULL DEFAULT 'not_started',
  access_tier        portal.access_tier NOT NULL DEFAULT 'tier_1',
  nda_accepted       BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step    INTEGER NOT NULL DEFAULT 1,
  advisor_id         TEXT REFERENCES portal.users(id),
  source             TEXT,
  notes              TEXT,
  preferences        JSONB,  -- communication preferences
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_profiles_verification_idx ON portal.investor_profiles (verification_status);

CREATE TABLE portal.investor_criteria (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL UNIQUE REFERENCES portal.users(id) ON DELETE CASCADE,
  currency            TEXT NOT NULL DEFAULT 'USD',
  equity_available    NUMERIC(18,2),
  total_capacity      NUMERIC(18,2),
  min_ticket          NUMERIC(18,2),
  max_ticket          NUMERIC(18,2),
  geographies         JSONB,
  asset_classes       JSONB,
  structures          JSONB,
  min_gross_yield     NUMERIC(6,4),
  min_net_yield       NUMERIC(6,4),
  target_irr          NUMERIC(6,4),
  target_cash_on_cash NUMERIC(6,4),
  target_payback_years NUMERIC(6,2),
  hold_period_min     NUMERIC(6,2),
  hold_period_max     NUMERIC(6,2),
  leverage_comfort    NUMERIC(5,2),
  financing_open      BOOLEAN NOT NULL DEFAULT TRUE,
  risk_tolerance      portal.risk_tolerance,
  exit_preferences    JSONB,
  currency_note       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Interaction with Sanity-sourced opportunities
-- -----------------------------------------------------------------------------
CREATE TABLE portal.saved_opportunities (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  sanity_id  TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sanity_id)
);
CREATE INDEX portal_saved_opps_user_idx ON portal.saved_opportunities (user_id, created_at);

CREATE TABLE portal.opportunity_views (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  sanity_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_opp_views_content_idx ON portal.opportunity_views (sanity_id, viewed_at);
CREATE INDEX portal_opp_views_user_idx ON portal.opportunity_views (user_id, viewed_at);

CREATE TABLE portal.saved_searches (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  filters      JSONB NOT NULL,
  alert_on_new BOOLEAN NOT NULL DEFAULT FALSE,
  last_alert_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_saved_searches_user_idx ON portal.saved_searches (user_id);

-- -----------------------------------------------------------------------------
-- Investment Studio
-- -----------------------------------------------------------------------------
CREATE TABLE portal.scenarios (
  id                   TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  sanity_opportunity_id TEXT,
  opportunity_title   TEXT,
  inputs              JSONB NOT NULL,     -- full transparent assumption set
  summary             JSONB,              -- computed metrics snapshot at save
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_scenarios_user_idx ON portal.scenarios (user_id, updated_at);

CREATE TABLE portal.comparisons (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sanity_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
  scenario_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_comparisons_user_idx ON portal.comparisons (user_id, updated_at);

-- -----------------------------------------------------------------------------
-- Orders & payments
-- -----------------------------------------------------------------------------
CREATE TABLE portal.orders (
  id                   TEXT PRIMARY KEY,
  reference            TEXT NOT NULL UNIQUE,        -- MVR-ORD-XXXXXX
  user_id              TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  brief_source         portal.order_source NOT NULL DEFAULT 'catalog',
  sanity_brief_id      TEXT,
  sanity_opportunity_id TEXT,
  brief_title          TEXT NOT NULL,               -- snapshot at order time
  brief_type           portal.order_type NOT NULL DEFAULT 'private_brief',
  format               portal.order_format NOT NULL DEFAULT 'digital',
  custom_scope         TEXT,
  amount_kes           NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd           NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'KES',
  status               portal.order_status NOT NULL DEFAULT 'pending',
  payment_method       portal.payment_method,
  transaction_id       TEXT,
  contact_name         TEXT,
  contact_email        TEXT,
  organisation         TEXT,
  shipping_address     TEXT,
  phone                TEXT,
  delivery_method      TEXT,                        -- secure_download | courier
  tracking_number      TEXT,
  cancelled_at         TIMESTAMPTZ,
  cancellation_reason  TEXT,
  delivered_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_amount_nonnegative CHECK (amount_kes >= 0 AND amount_usd >= 0)
);
CREATE INDEX portal_orders_user_idx ON portal.orders (user_id, created_at);
CREATE INDEX portal_orders_status_idx ON portal.orders (status);

CREATE TABLE portal.payments (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES portal.orders(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  method           portal.payment_method NOT NULL,
  amount_kes       NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd       NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'KES',
  reference        TEXT,
  confirmation_raw TEXT,
  status           portal.payment_status NOT NULL DEFAULT 'submitted',
  verified_by_id   TEXT REFERENCES portal.users(id),
  verified_at      TIMESTAMPTZ,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_payments_order_idx ON portal.payments (order_id);
CREATE INDEX portal_payments_status_idx ON portal.payments (status);

-- -----------------------------------------------------------------------------
-- Mandates
-- -----------------------------------------------------------------------------
CREATE TABLE portal.mandates (
  id                   TEXT PRIMARY KEY,
  reference            TEXT NOT NULL UNIQUE,        -- MVR-MND-XXXXXX
  user_id              TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  status               portal.mandate_status NOT NULL DEFAULT 'draft',
  description          TEXT,
  target_allocation_min NUMERIC(18,2),
  target_allocation_max NUMERIC(18,2),
  currency             TEXT NOT NULL DEFAULT 'USD',
  geographies          JSONB,
  asset_classes        JSONB,
  structures           JSONB,
  min_net_yield        NUMERIC(6,4),
  target_irr           NUMERIC(6,4),
  hold_period_min      NUMERIC(6,2),
  hold_period_max      NUMERIC(6,2),
  leverage_comfort     NUMERIC(5,2),
  risk_mandate         portal.risk_tolerance,
  exclusions           JSONB,
  advisor_id           TEXT REFERENCES portal.users(id),
  submitted_at         TIMESTAMPTZ,
  activated_at         TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_mandates_user_idx ON portal.mandates (user_id, status);

CREATE TABLE portal.mandate_milestones (
  id           TEXT PRIMARY KEY,
  mandate_id   TEXT NOT NULL REFERENCES portal.mandates(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  detail       TEXT,
  due_date     TIMESTAMPTZ,
  status       portal.milestone_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_milestones_mandate_idx ON portal.mandate_milestones (mandate_id);

-- -----------------------------------------------------------------------------
-- Communications
-- -----------------------------------------------------------------------------
CREATE TABLE portal.enquiries (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  subject              TEXT NOT NULL,
  message              TEXT NOT NULL,
  sanity_opportunity_id TEXT,
  opportunity_title    TEXT,
  status               portal.enquiry_status NOT NULL DEFAULT 'open',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_enquiries_user_idx ON portal.enquiries (user_id, created_at);

CREATE TABLE portal.messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,  -- investor thread owner
  sender_type portal.message_sender NOT NULL DEFAULT 'investor',
  sender_id   TEXT REFERENCES portal.users(id),
  enquiry_id  TEXT REFERENCES portal.enquiries(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_messages_user_idx ON portal.messages (user_id, created_at);
CREATE INDEX portal_messages_enquiry_idx ON portal.messages (enquiry_id);

CREATE TABLE portal.notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  type       portal.notification_type NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_notifications_user_idx ON portal.notifications (user_id, read_at);

-- -----------------------------------------------------------------------------
-- Secure data room
-- -----------------------------------------------------------------------------
CREATE TABLE portal.document_grants (
  id                 TEXT PRIMARY KEY,
  sanity_document_id TEXT NOT NULL,
  user_id            TEXT REFERENCES portal.users(id) ON DELETE CASCADE,
  organisation_id    TEXT REFERENCES portal.organisations(id) ON DELETE CASCADE,
  granted_by_id      TEXT NOT NULL REFERENCES portal.users(id),
  permission         portal.doc_permission NOT NULL DEFAULT 'view',
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT grant_target CHECK (user_id IS NOT NULL OR organisation_id IS NOT NULL),
  UNIQUE (sanity_document_id, user_id, organisation_id)
);

CREATE TABLE portal.document_access_logs (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  sanity_document_id TEXT NOT NULL,
  document_title    TEXT,
  action            portal.doc_access_action NOT NULL,
  ip                INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_doc_access_user_idx ON portal.document_access_logs (user_id, created_at);
CREATE INDEX portal_doc_access_doc_idx ON portal.document_access_logs (sanity_document_id, created_at);

CREATE TABLE portal.document_requests (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  subject             TEXT NOT NULL,
  detail              TEXT,
  sanity_opportunity_id TEXT,
  type                portal.doc_request_type NOT NULL DEFAULT 'data_room',
  status              portal.doc_request_status NOT NULL DEFAULT 'submitted',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_doc_requests_user_idx ON portal.document_requests (user_id, status);

CREATE TABLE portal.nda_agreements (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  version    TEXT NOT NULL,
  ip         INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

-- -----------------------------------------------------------------------------
-- Portfolio & capital calls
-- -----------------------------------------------------------------------------
CREATE TABLE portal.portfolio_positions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  sanity_opportunity_id TEXT,
  asset_class         TEXT,
  geography           TEXT,
  status              portal.position_status NOT NULL DEFAULT 'committed',
  acquisition_date    TIMESTAMPTZ,
  purchase_price      NUMERIC(18,2),
  currency            TEXT NOT NULL DEFAULT 'USD',
  equity_deployed     NUMERIC(18,2),
  debt_amount         NUMERIC(18,2),
  debt_rate           NUMERIC(6,4),
  debt_maturity       TIMESTAMPTZ,
  gross_income_annual NUMERIC(18,2),
  operating_expenses  NUMERIC(18,2),
  noi_actual          NUMERIC(18,2),
  occupancy_pct       NUMERIC(5,2),
  valuation           NUMERIC(18,2),
  valuation_date      TIMESTAMPTZ,
  valuation_basis     TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_positions_user_idx ON portal.portfolio_positions (user_id, status);

CREATE TABLE portal.capital_calls (
  id          TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES portal.portfolio_positions(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  amount      NUMERIC(18,2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USD',
  due_date    TIMESTAMPTZ,
  status      portal.capital_call_status NOT NULL DEFAULT 'scheduled',
  called_at   TIMESTAMPTZ,
  paid_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_capital_calls_idx ON portal.capital_calls (position_id, status);

-- -----------------------------------------------------------------------------
-- Audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE audit.logs (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT,
  actor_type portal.actor_type NOT NULL DEFAULT 'user',
  action     TEXT NOT NULL,          -- e.g. auth.login, order.created, document.downloaded, permission.changed
  entity     TEXT,
  entity_id  TEXT,
  detail     JSONB,
  ip         INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx    ON audit.logs (created_at);
CREATE INDEX audit_logs_actor_idx      ON audit.logs (actor_id, created_at);
CREATE INDEX audit_logs_entity_idx     ON audit.logs (entity, entity_id);

-- -----------------------------------------------------------------------------
-- Shared triggers: updated_at maintenance + critical-action audit capture
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Auto-audit for critical tables (orders, payments, document grants, profiles)
CREATE OR REPLACE FUNCTION audit.log_change() RETURNS trigger AS $$
DECLARE
  v_actor TEXT;
  v_entity TEXT;
  v_entity_id TEXT;
BEGIN
  v_entity   := TG_ARGV[0];
  v_actor    := NULLIF(current_setting('app.actor_id', true), '');
  v_entity_id := COALESCE(NEW.id, OLD.id);
  INSERT INTO audit.logs (id, actor_id, actor_type, action, entity, entity_id, detail)
  VALUES (
    'audit-' || replace(gen_random_uuid()::text, '-', ''),
    v_actor,
    CASE WHEN v_actor IS NULL THEN 'system'::portal.actor_type ELSE 'user'::portal.actor_type END,
    TG_ARGV[0] || '.' || TG_OP::text,
    v_entity,
    v_entity_id,
    jsonb_build_object('operation', TG_OP, 'new', to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW END), 'old', to_jsonb(CASE WHEN TG_OP = 'UPDATE' THEN OLD END))
  );
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','organisations','investor_profiles','investor_criteria',
    'orders','payments','mandates','mandate_milestones',
    'document_grants','portfolio_positions','capital_calls',
    'scenarios','comparisons','enquiries','organisation_members'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON portal.%I
                   FOR EACH ROW EXECUTE FUNCTION portal.touch_updated_at()', t, t);
  END LOOP;
END; $$;

CREATE TRIGGER trg_orders_audit    AFTER INSERT OR UPDATE OR DELETE ON portal.orders
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('order');
CREATE TRIGGER trg_payments_audit AFTER INSERT OR UPDATE OR DELETE ON portal.payments
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('payment');
CREATE TRIGGER trg_docgrants_audit AFTER INSERT OR DELETE ON portal.document_grants
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('permission');
CREATE TRIGGER trg_profiles_audit AFTER UPDATE OF verification_status, kyc_status, access_tier, nda_accepted ON portal.investor_profiles
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('profile');

COMMIT;
