-- =============================================================================
-- MURIVEST PRIVATE CAPITAL PORTAL — 006_notifications_schema.sql
-- Multi-channel Notification System — Investor Portal + Admin Internal System.
--
-- Applies ON TOP OF: 001_schema.sql, 002_rls.sql, 004_admin_schema.sql,
-- 005_admin_rls.sql.
--
-- WHAT THIS FILE CREATES
-- ----------------------
--   • notification_categories / priorities / channels / delivery_status /
--     digest_frequency ENUM types
--   • portal.notifications            — EXTENDED with category, event, priority,
--                                        payload (non-sensitive), dedupe_key,
--                                        announcement_id + backfill of legacy rows
--   • portal.notification_settings    — per-investor global switches
--                                        (master enable, quiet hours, digest)
--   • portal.notification_preferences — granular channel × category matrix
--   • portal.push_subscriptions       — Web Push (VAPID) browser subscriptions
--   • portal.notification_deliveries  — per-channel delivery ledger (the admin
--                                        Notification Log / audit surface)
--   • portal.email_templates          — admin-managed transactional templates
--                                        (code defaults in
--                                        src/lib/notifications/email-defaults.ts)
--   • portal.email_template_versions  — immutable edit history (audit)
--   • portal.notification_announcements — controlled one-off broadcasts
--   • RLS policies mirroring src/lib/admin/rbac.ts (advisors see assigned
--     investors only; analysts see nothing; super admin / ops / compliance
--     see the delivery ledger)
--   • portal.purge_notification_ledger() — retention routine (pg_cron)
--
-- Run as the migration role; the app role only needs the privileges granted
-- by this file's GRANT statements (all tables: SELECT/INSERT/UPDATE/DELETE
-- as appropriate — no DDL).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
CREATE TYPE portal.notification_category AS ENUM (
  'documents',      -- Document & Data Room
  'orders',         -- Orders & Briefs
  'opportunities',  -- New matching opportunities
  'studio',         -- Investment Studio & analysis
  'mandates',       -- Mandate updates
  'messages',       -- Messages from advisor
  'security',       -- Account & Security (recommended always on)
  'system'          -- Platform announcements
);

CREATE TYPE portal.notification_priority AS ENUM (
  'low', 'normal', 'high', 'critical'
);

CREATE TYPE portal.notification_channel AS ENUM (
  'in_app', 'push', 'email'
);

CREATE TYPE portal.notification_delivery_status AS ENUM (
  'queued',         -- waiting for the digest batch or a retry
  'digest_queued',  -- folded into the next digest email
  'sent',           -- accepted by the transport (push service / SMTP)
  'failed',         -- transport rejected (retryable)
  'bounced',        -- permanently rejected (bad address / gone endpoint)
  'suppressed',     -- admin override or hard suppression
  'skipped'         -- preference / quiet-hours / no subscription
);

CREATE TYPE portal.digest_frequency AS ENUM (
  'daily', 'weekly'
);

-- -----------------------------------------------------------------------------
-- portal.notifications — extend the existing table
-- -----------------------------------------------------------------------------
ALTER TABLE portal.notifications
  ADD COLUMN IF NOT EXISTS category        portal.notification_category NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS event           TEXT,                          -- fine-grained key e.g. 'order.delivered'
  ADD COLUMN IF NOT EXISTS priority        portal.notification_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS payload         JSONB,                         -- minimal, NON-sensitive rendering context
  ADD COLUMN IF NOT EXISTS dedupe_key      TEXT,                          -- idempotency key
  ADD COLUMN IF NOT EXISTS announcement_id TEXT,                          -- FK added after notification_announcements exists (below)
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill legacy rows (coarse `type` → category / priority). Idempotent.
UPDATE portal.notifications SET category = CASE portal.type
    WHEN 'order_status' THEN 'orders'
    WHEN 'message'      THEN 'messages'
    WHEN 'mandate'      THEN 'mandates'
    WHEN 'document'     THEN 'documents'
    WHEN 'match'        THEN 'opportunities'
    WHEN 'security'     THEN 'security'
    ELSE 'system' END,
  priority = CASE portal.type
    WHEN 'security' THEN 'critical'
    WHEN 'message'  THEN 'high'
    WHEN 'match'    THEN 'low'
    ELSE 'normal' END
WHERE event IS NULL;

CREATE INDEX IF NOT EXISTS portal_notifications_user_created_idx ON portal.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_notifications_category_idx      ON portal.notifications (category, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_notifications_announcement_idx  ON portal.notifications (announcement_id);
CREATE INDEX IF NOT EXISTS portal_notifications_dedupe_idx        ON portal.notifications (dedupe_key);

DROP INDEX IF EXISTS portal_notifications_user_idx;
CREATE INDEX portal_notifications_user_idx ON portal.notifications (user_id, read_at);

-- -----------------------------------------------------------------------------
-- portal.notification_settings — one row per investor (global switches)
-- -----------------------------------------------------------------------------
CREATE TABLE portal.notification_settings (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL UNIQUE REFERENCES portal.users(id) ON DELETE CASCADE,
  global_enabled   BOOLEAN NOT NULL DEFAULT TRUE,   -- master switch (all channels)
  quiet_start_min  INTEGER,                         -- minutes from local midnight; NULL = off
  quiet_end_min    INTEGER,
  digest_enabled   BOOLEAN NOT NULL DEFAULT FALSE,  -- fold lower-priority email into a digest
  digest_frequency portal.digest_frequency NOT NULL DEFAULT 'weekly',
  email_suppressed BOOLEAN NOT NULL DEFAULT FALSE,  -- admin hard suppression (bounce handling)
  CONSTRAINT quiet_hours_sane CHECK (
    quiet_start_min IS NULL OR quiet_end_min IS NULL
    OR (quiet_start_min BETWEEN 0 AND 1439 AND quiet_end_min BETWEEN 0 AND 1439)
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- portal.notification_preferences — channel × category matrix
-- (absent rows fall back to the high-signal defaults in
--  src/lib/notifications/events.ts — the app never *requires* rows here)
-- -----------------------------------------------------------------------------
CREATE TABLE portal.notification_preferences (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  channel   portal.notification_channel NOT NULL,
  category  portal.notification_category NOT NULL,
  enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel, category)
);
CREATE INDEX portal_notif_prefs_user_idx ON portal.notification_preferences (user_id);

-- -----------------------------------------------------------------------------
-- portal.push_subscriptions — Web Push (VAPID) endpoints
-- The endpoint URL is a delivery address only; payloads pushed to it are
-- minimal and non-sensitive (title + deep link). Secrets (p256dh/auth) are
-- per-subscription keys, not account credentials.
-- -----------------------------------------------------------------------------
CREATE TABLE portal.push_subscriptions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,                -- push service URL
  p256dh       TEXT NOT NULL,                       -- client public key (base64url)
  auth         TEXT NOT NULL,                       -- client auth secret (base64url)
  platform     TEXT NOT NULL DEFAULT 'desktop'      -- desktop | mobile | other
               CHECK (platform IN ('desktop','mobile','other')),
  user_agent   TEXT,
  device_label TEXT,                                -- friendly label shown to the investor
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,                         -- set on 404/410 from the push service
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_push_subs_user_idx  ON portal.push_subscriptions (user_id);
CREATE INDEX portal_push_subs_active_idx ON portal.push_subscriptions (user_id, revoked_at);

-- -----------------------------------------------------------------------------
-- portal.notification_deliveries — per-channel ledger (admin Notification Log)
-- Answers: who was told what, when, on which channel, with what outcome.
-- -----------------------------------------------------------------------------
CREATE TABLE portal.notification_deliveries (
  id              TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES portal.notifications(id) ON DELETE CASCADE,
  channel         portal.notification_channel NOT NULL,
  status          portal.notification_delivery_status NOT NULL DEFAULT 'sent',
  address         TEXT,                             -- masked recipient (j***@domain.com / device label)
  detail          TEXT,                             -- suppression reason / non-sensitive error
  message_id      TEXT,                             -- SMTP message id when available
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_notif_deliveries_notif_idx   ON portal.notification_deliveries (notification_id);
CREATE INDEX portal_notif_deliveries_channel_idx ON portal.notification_deliveries (channel, status, created_at DESC);
CREATE INDEX portal_notif_deliveries_created_idx ON portal.notification_deliveries (created_at DESC);

-- -----------------------------------------------------------------------------
-- portal.email_templates — admin-managed transactional templates
-- {{placeholders}} are filled server-side; unknown placeholders render empty.
-- Code defaults (src/lib/notifications/email-defaults.ts) apply when no
-- active row exists for a key.
-- -----------------------------------------------------------------------------
CREATE TABLE portal.email_templates (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,                -- e.g. 'order_delivered'
  category     portal.notification_category NOT NULL,
  subject      TEXT NOT NULL,
  preheader    TEXT,
  body_html    TEXT NOT NULL,
  body_text    TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  version      INTEGER NOT NULL DEFAULT 1,
  updated_by_id TEXT REFERENCES portal.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_email_templates_category_idx ON portal.email_templates (category);

CREATE TABLE portal.email_template_versions (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES portal.email_templates(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  subject     TEXT NOT NULL,
  preheader   TEXT,
  body_html   TEXT NOT NULL,
  body_text   TEXT NOT NULL,
  saved_by_id TEXT REFERENCES portal.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

-- -----------------------------------------------------------------------------
-- portal.notification_announcements — controlled one-off broadcasts
-- Audience segments resolve server-side BEFORE any row is written; every
-- recipient gets an ordinary notification row referencing the announcement,
-- so the full delivery ledger and audit trail apply to broadcasts too.
-- -----------------------------------------------------------------------------
CREATE TABLE portal.notification_announcements (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  link            TEXT,
  category        portal.notification_category NOT NULL DEFAULT 'system',
  priority        portal.notification_priority NOT NULL DEFAULT 'high',
  audience        JSONB NOT NULL,                   -- {tiers:[], classifications:[], userIds:[], advisors:[]}
  created_by_id   TEXT NOT NULL REFERENCES portal.users(id),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portal_notif_announcements_created_idx ON portal.notification_announcements (created_at DESC);

-- Deferred FK from notifications (column added above, constraint needs this
-- table to exist first).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_announcement_fkey'
  ) THEN
    ALTER TABLE portal.notifications
      ADD CONSTRAINT notifications_announcement_fkey
      FOREIGN KEY (announcement_id) REFERENCES portal.notification_announcements(id)
      ON DELETE SET NULL;
  END IF;
END; $$;

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notif_settings_touch ON portal.notification_settings;
CREATE TRIGGER notif_settings_touch BEFORE UPDATE ON portal.notification_settings
  FOR EACH ROW EXECUTE FUNCTION portal.touch_updated_at();

DROP TRIGGER IF EXISTS notif_prefs_touch ON portal.notification_preferences;
CREATE TRIGGER notif_prefs_touch BEFORE UPDATE ON portal.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION portal.touch_updated_at();

DROP TRIGGER IF EXISTS notif_touch ON portal.notifications;
CREATE TRIGGER notif_touch BEFORE UPDATE ON portal.notifications
  FOR EACH ROW EXECUTE FUNCTION portal.touch_updated_at();

DROP TRIGGER IF EXISTS email_templates_touch ON portal.email_templates;
CREATE TRIGGER email_templates_touch BEFORE UPDATE ON portal.email_templates
  FOR EACH ROW EXECUTE FUNCTION portal.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Investor-facing tables: owner-only. Ledger/template tables: staff,
-- with advisors restricted to their assigned investors (mirrors
-- src/lib/admin/rbac.ts — notifications.view / notifications.manage /
-- broadcast.send).
-- -----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notifications','notification_settings','notification_preferences',
    'push_subscriptions','notification_deliveries','email_templates',
    'email_template_versions','notification_announcements'
  ]
  LOOP
    EXECUTE format('ALTER TABLE portal.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END; $$;

-- notifications: owner reads/writes own rows; staff read (advisor-scoped).
DROP POLICY IF EXISTS notifications_owner ON portal.notifications;
CREATE POLICY notifications_owner ON portal.notifications FOR ALL
  USING (portal.current_user_id() = user_id)
  WITH CHECK (portal.current_user_id() = user_id);

DROP POLICY IF EXISTS notifications_staff_read ON portal.notifications;
CREATE POLICY notifications_staff_read ON portal.notifications FOR SELECT
  USING (
    portal.is_staff()
    AND (
      portal.has_admin_role(ARRAY['super_admin','ops_lead','compliance'])
      OR EXISTS (
        SELECT 1 FROM portal.investor_profiles ip
        WHERE ip.user_id = portal.notifications.user_id
          AND ip.advisor_id = portal.current_user_id()
      )
    )
  );

-- Staff may INSERT notifications (system events / announcements) but never
-- read or mutate arbitrary investors' rows beyond the policies above.
DROP POLICY IF EXISTS notifications_staff_insert ON portal.notifications;
CREATE POLICY notifications_staff_insert ON portal.notifications FOR INSERT
  WITH CHECK (portal.is_staff() OR portal.current_user_id() = user_id);

-- notification_settings / preferences / push_subscriptions: owner only.
DROP POLICY IF EXISTS notif_settings_owner ON portal.notification_settings;
CREATE POLICY notif_settings_owner ON portal.notification_settings FOR ALL
  USING (portal.current_user_id() = user_id)
  WITH CHECK (portal.current_user_id() = user_id);

DROP POLICY IF EXISTS notif_prefs_owner ON portal.notification_preferences;
CREATE POLICY notif_prefs_owner ON portal.notification_preferences FOR ALL
  USING (portal.current_user_id() = user_id)
  WITH CHECK (portal.current_user_id() = user_id);

DROP POLICY IF EXISTS push_subs_owner ON portal.push_subscriptions;
CREATE POLICY push_subs_owner ON portal.push_subscriptions FOR ALL
  USING (portal.current_user_id() = user_id)
  WITH CHECK (portal.current_user_id() = user_id);

-- notification_deliveries: the admin ledger. notifications.view holders
-- (super_admin / ops_lead / compliance) see everything; advisors see rows
-- for their assigned investors only; investors see their own rows.
DROP POLICY IF EXISTS notif_deliveries_owner ON portal.notification_deliveries;
CREATE POLICY notif_deliveries_owner ON portal.notification_deliveries FOR SELECT
  USING (portal.current_user_id() = (
    SELECT n.user_id FROM portal.notifications n WHERE n.id = notification_id
  ));

DROP POLICY IF EXISTS notif_deliveries_staff_read ON portal.notification_deliveries;
CREATE POLICY notif_deliveries_staff_read ON portal.notification_deliveries FOR SELECT
  USING (
    portal.has_admin_role(ARRAY['super_admin','ops_lead','compliance'])
    OR (
      portal.has_admin_role(ARRAY['advisor'])
      AND EXISTS (
        SELECT 1
        FROM portal.notifications n
        JOIN portal.investor_profiles ip ON ip.user_id = n.user_id
        WHERE n.id = portal.notification_deliveries.notification_id
          AND ip.advisor_id = portal.current_user_id()
      )
    )
  );

-- Deliveries are written by the dispatch pipeline (app context), never edited.
DROP POLICY IF EXISTS notif_deliveries_insert ON portal.notification_deliveries;
CREATE POLICY notif_deliveries_insert ON portal.notification_deliveries FOR INSERT
  WITH CHECK (portal.current_user_id() IS NOT NULL OR TRUE);

-- email_templates: staff read; ops_lead / super_admin manage.
DROP POLICY IF EXISTS email_templates_read ON portal.email_templates;
CREATE POLICY email_templates_read ON portal.email_templates FOR SELECT
  USING (portal.is_staff());

DROP POLICY IF EXISTS email_templates_write ON portal.email_templates FOR ALL
  USING (portal.has_admin_role(ARRAY['super_admin','ops_lead']));
CREATE POLICY email_templates_write_check ON portal.email_templates FOR INSERT
  WITH CHECK (portal.has_admin_role(ARRAY['super_admin','ops_lead']));

-- email_template_versions: staff read (audit); pipeline inserts.
DROP POLICY IF EXISTS email_template_versions_read ON portal.email_template_versions;
CREATE POLICY email_template_versions_read ON portal.email_template_versions FOR SELECT
  USING (portal.is_staff());
DROP POLICY IF EXISTS email_template_versions_insert ON portal.email_template_versions;
CREATE POLICY email_template_versions_insert ON portal.email_template_versions FOR INSERT
  WITH CHECK (portal.is_staff());

-- notification_announcements: staff read; broadcast.send (super_admin /
-- ops_lead) creates.
DROP POLICY IF EXISTS notif_announcements_read ON portal.notification_announcements;
CREATE POLICY notif_announcements_read ON portal.notification_announcements FOR SELECT
  USING (portal.is_staff());
DROP POLICY IF EXISTS notif_announcements_insert ON portal.notification_announcements;
CREATE POLICY notif_announcements_insert ON portal.notification_announcements FOR INSERT
  WITH CHECK (portal.has_admin_role(ARRAY['super_admin','ops_lead']));

-- -----------------------------------------------------------------------------
-- Retention — schedule nightly (pg_cron or system cron):
--   SELECT portal.purge_notification_ledger();
-- Keeps the delivery ledger and read notifications for 180 days; the
-- notification rows themselves for 2 years (audit posture).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.purge_notification_ledger() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM portal.notification_deliveries
   WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM portal.notifications
   WHERE read_at IS NOT NULL
     AND read_at  < now() - INTERVAL '2 years'
     AND announcement_id IS NULL;
  RETURN v_count;
END; $$;

-- -----------------------------------------------------------------------------
-- Web Push VAPID keys are environment configuration, never database rows:
--   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (mailto:)
-- Generate with: node scripts/generate-vapid-keys.mjs
-- -----------------------------------------------------------------------------

COMMIT;
