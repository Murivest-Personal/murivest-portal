-- =============================================================================
-- MURIVEST PRIVATE CAPITAL PORTAL — 004_admin_schema.sql
-- Admin Internal System (production PostgreSQL DDL).
--
-- Extends the investor-facing schema (001/002/003) with the operational
-- backbone used by Murivest staff (Advisors, Operations, Compliance,
-- Finance, Content and Super Administrators):
--
--   • staff_profiles          — granular admin RBAC roles (one per staff user)
--   • order_status_events     — full order lifecycle history (Orders Engine)
--   • revenue_events          — revenue recognition ledger (one per order)
--   • refund_adjustments      — controlled refunds / adjustments workflow
--   • compliance_reviews      — KYC/AML review record with before/after snapshot
--   • internal_notes          — staff-only notes on any entity
--   • content_meta            — admin governance layer over Sanity content
--                               (visibility override, tags, archive state)
--   • system_settings         — feature flags & integration configuration
--   • orders (altered)        — assignment, advisor attribution, priority,
--                               due date, secure-delivery document, closed_at
--   • mandates (altered)      — pipeline stage, win probability, next action
--
-- Apply AFTER 001/002/003:
--   psql "$DIRECT_URL" -f sql/004_admin_schema.sql
--   psql "$DIRECT_URL" -f sql/005_admin_rls.sql
--
-- Enum values for order_status are extended first (outside the transaction:
-- ALTER TYPE ... ADD VALUE cannot run inside a block on PostgreSQL < 12).
-- =============================================================================

ALTER TYPE portal.order_status ADD VALUE IF NOT EXISTS 'internal_review';
ALTER TYPE portal.order_status ADD VALUE IF NOT EXISTS 'closed';

BEGIN;

-- -----------------------------------------------------------------------------
-- Enumerated domains (mirrored app-side by src/lib/admin/rbac.ts)
-- -----------------------------------------------------------------------------
CREATE TYPE portal.admin_role AS ENUM
  ('super_admin','ops_lead','advisor','compliance','finance','content','analyst');

CREATE TYPE portal.order_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE portal.order_event_note  AS TEXT; -- free-form note on status events

CREATE TYPE portal.mandate_stage AS ENUM
  ('sourcing','qualification','matching','negotiation','closing','post_closing');

CREATE TYPE portal.refund_status AS ENUM ('proposed','approved','rejected','applied');
CREATE TYPE portal.review_decision AS ENUM ('approved','rejected','escalated','note');
CREATE TYPE portal.note_visibility AS ENUM ('staff','admins');
CREATE TYPE portal.content_status AS ENUM ('live','paused','archived');
CREATE TYPE portal.content_type   AS ENUM ('opportunity','brief','document','report');
CREATE TYPE portal.setting_category AS ENUM ('general','feature_flag','integration');
CREATE TYPE portal.actor_type_admin AS ENUM ('user','advisor','admin','system'); -- parity alias

-- -----------------------------------------------------------------------------
-- Staff role registry — granular RBAC on top of users.role (investor|advisor|admin).
-- users.role remains the coarse staff gate; staff_profiles.admin_role drives the
-- permission matrix enforced in src/lib/admin/rbac.ts AND at the DB level (005).
-- -----------------------------------------------------------------------------
CREATE TABLE portal.staff_profiles (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL UNIQUE REFERENCES portal.users(id) ON DELETE CASCADE,
  admin_role  portal.admin_role NOT NULL DEFAULT 'advisor',
  title       TEXT,
  team        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_staff_profiles_role_idx ON portal.staff_profiles (admin_role, is_active);

-- -----------------------------------------------------------------------------
-- Orders Engine — immutable lifecycle history for every status transition.
-- -----------------------------------------------------------------------------
CREATE TABLE portal.order_status_events (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES portal.orders(id) ON DELETE CASCADE,
  from_status  portal.order_status,
  to_status    portal.order_status NOT NULL,
  changed_by_id TEXT REFERENCES portal.users(id),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_order_events_order_idx ON portal.order_status_events (order_id, created_at);

-- -----------------------------------------------------------------------------
-- Revenue recognition ledger — exactly one row per order, written when the
-- order is delivered AND payment is verified. Updated (never deleted) when a
-- refund adjustment is approved. Distinguishes RECOGNISED revenue from
-- CASH COLLECTED (derived from verified payments at query time).
-- -----------------------------------------------------------------------------
CREATE TABLE portal.revenue_events (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL UNIQUE REFERENCES portal.orders(id) ON DELETE CASCADE,
  gross_kes        NUMERIC(18,2) NOT NULL DEFAULT 0,
  gross_usd        NUMERIC(18,2) NOT NULL DEFAULT 0,
  processing_usd   NUMERIC(18,2) NOT NULL DEFAULT 0,  -- payment processing cost estimate
  refund_usd       NUMERIC(18,2) NOT NULL DEFAULT 0,  -- approved refunds, cumulative
  net_usd          NUMERIC(18,2) NOT NULL DEFAULT 0,  -- gross - processing - refunds
  recognised_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  recognised_by_id TEXT REFERENCES portal.users(id),
  note             TEXT,
  CONSTRAINT revenue_non_negative CHECK (gross_usd >= 0 AND gross_kes >= 0)
);
CREATE INDEX portal_revenue_events_date_idx ON portal.revenue_events (recognised_at);

-- -----------------------------------------------------------------------------
-- Controlled refunds / adjustments (Finance or Super Admin approval only).
-- -----------------------------------------------------------------------------
CREATE TABLE portal.refund_adjustments (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES portal.orders(id) ON DELETE CASCADE,
  amount_usd      NUMERIC(18,2) NOT NULL,
  amount_kes      NUMERIC(18,2) NOT NULL DEFAULT 0,
  reason          TEXT NOT NULL,
  status          portal.refund_status NOT NULL DEFAULT 'proposed',
  requested_by_id TEXT NOT NULL REFERENCES portal.users(id),
  reviewed_by_id  TEXT REFERENCES portal.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT refund_positive CHECK (amount_usd > 0)
);
CREATE INDEX portal_refunds_order_idx  ON portal.refund_adjustments (order_id);
CREATE INDEX portal_refunds_status_idx ON portal.refund_adjustments (status);

-- -----------------------------------------------------------------------------
-- Compliance / KYC review record — captures the decision, risk flags and the
-- before/after snapshot for every verification workflow action.
-- -----------------------------------------------------------------------------
CREATE TABLE portal.compliance_reviews (
  id              TEXT PRIMARY KEY,
  subject_user_id TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  reviewer_id     TEXT NOT NULL REFERENCES portal.users(id),
  decision        portal.review_decision NOT NULL,
  notes           TEXT,
  risk_flags      JSONB,   -- [{flag, severity, note}]
  detail          JSONB,   -- {before:{...}, after:{...}, actions:[...]}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_compliance_reviews_subject_idx ON portal.compliance_reviews (subject_user_id, created_at);

-- -----------------------------------------------------------------------------
-- Internal (staff-only) notes attached to any entity.
-- -----------------------------------------------------------------------------
CREATE TABLE portal.internal_notes (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,  -- investor|order|mandate|opportunity|enquiry|organisation|compliance|content
  entity_id   TEXT NOT NULL,
  author_id   TEXT NOT NULL REFERENCES portal.users(id),
  body        TEXT NOT NULL,
  visibility  portal.note_visibility NOT NULL DEFAULT 'staff',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_internal_notes_entity_idx ON portal.internal_notes (entity_type, entity_id, created_at);

-- -----------------------------------------------------------------------------
-- Content governance — admin metadata layered over Sanity-authored content.
-- Sanity remains the source of truth for the content itself (properties,
-- briefs, documents, market reports are uploaded/managed there); this table
-- holds the operational state Murivest staff control from the Admin system:
-- visibility floor, curation tags, live/paused/archived state, feature flag.
-- Portal read queries intersect Sanity results with this metadata.
-- -----------------------------------------------------------------------------
CREATE TABLE portal.content_meta (
  id              TEXT PRIMARY KEY,
  content_type    portal.content_type NOT NULL,
  sanity_id       TEXT NOT NULL,
  title           TEXT,                 -- snapshot for lists when Sanity is unreachable
  tags            JSONB,                -- ["off_market","auction","mandate_match", ...]
  status          portal.content_status NOT NULL DEFAULT 'live',
  featured        BOOLEAN NOT NULL DEFAULT FALSE,
  visibility_tier portal.access_tier NOT NULL DEFAULT 'tier_1', -- minimum tier required (governance override)
  notes           TEXT,
  updated_by_id   TEXT REFERENCES portal.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_type, sanity_id)
);
CREATE INDEX portal_content_meta_status_idx ON portal.content_meta (content_type, status);

-- -----------------------------------------------------------------------------
-- System configuration — feature flags and integration settings (editable
-- JSON; secrets NEVER stored here — they remain environment variables).
-- -----------------------------------------------------------------------------
CREATE TABLE portal.system_settings (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  category     portal.setting_category NOT NULL DEFAULT 'general',
  value        JSONB,
  description  TEXT,
  updated_by_id TEXT REFERENCES portal.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Orders — fulfilment / attribution columns (Orders Engine + Revenue Card)
-- -----------------------------------------------------------------------------
ALTER TABLE portal.orders
  ADD COLUMN IF NOT EXISTS assigned_to_id      TEXT REFERENCES portal.users(id),
  ADD COLUMN IF NOT EXISTS advisor_id          TEXT REFERENCES portal.users(id),  -- revenue attribution
  ADD COLUMN IF NOT EXISTS priority            portal.order_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS due_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_document_id TEXT,                             -- Sanity doc delivered into data room
  ADD COLUMN IF NOT EXISTS closed_at           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS portal_orders_assigned_idx ON portal.orders (assigned_to_id, status);
CREATE INDEX IF NOT EXISTS portal_orders_advisor_idx  ON portal.orders (advisor_id);

-- -----------------------------------------------------------------------------
-- Mandates — pipeline management columns
-- -----------------------------------------------------------------------------
ALTER TABLE portal.mandates
  ADD COLUMN IF NOT EXISTS stage           portal.mandate_stage NOT NULL DEFAULT 'sourcing',
  ADD COLUMN IF NOT EXISTS probability     INTEGER NOT NULL DEFAULT 0,   -- 0–100 win probability
  ADD COLUMN IF NOT EXISTS next_action     TEXT,
  ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS portal_mandates_stage_idx ON portal.mandates (stage);

ALTER TABLE portal.mandates
  ADD CONSTRAINT mandate_probability_range CHECK (probability >= 0 AND probability <= 100);

-- -----------------------------------------------------------------------------
-- updated_at maintenance for the new tables
-- -----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff_profiles','content_meta','system_settings','revenue_events']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON portal.%I
                   FOR EACH ROW EXECUTE FUNCTION portal.touch_updated_at()', t, t);
  END LOOP;
END; $$;

-- -----------------------------------------------------------------------------
-- Audit capture for every sensitive admin mutation
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_staff_profiles_audit AFTER INSERT OR UPDATE OR DELETE ON portal.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('staff_profile');
CREATE TRIGGER trg_revenue_events_audit AFTER INSERT OR UPDATE OR DELETE ON portal.revenue_events
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('revenue_event');
CREATE TRIGGER trg_refunds_audit AFTER INSERT OR UPDATE OR DELETE ON portal.refund_adjustments
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('refund');
CREATE TRIGGER trg_compliance_reviews_audit AFTER INSERT ON portal.compliance_reviews
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('compliance_review');
CREATE TRIGGER trg_content_meta_audit AFTER INSERT OR UPDATE OR DELETE ON portal.content_meta
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('content_meta');
CREATE TRIGGER trg_system_settings_audit AFTER INSERT OR UPDATE OR DELETE ON portal.system_settings
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('system_setting');
CREATE TRIGGER trg_order_events_audit AFTER INSERT ON portal.order_status_events
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('order_status_event');
CREATE TRIGGER trg_internal_notes_audit AFTER INSERT OR DELETE ON portal.internal_notes
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('internal_note');
CREATE TRIGGER trg_orders_admin_audit AFTER UPDATE OF assigned_to_id, advisor_id, priority, status
  ON portal.orders FOR EACH ROW EXECUTE FUNCTION audit.log_change('order');

COMMIT;
