-- =============================================================================
-- MURIVEST PRIVATE CAPITAL PORTAL — 005_admin_rls.sql
-- Row Level Security for the Admin Internal System tables (004).
--
-- CONTEXT RESOLUTION
-- ------------------
-- The trusted Next.js server sets, per transaction:
--     SELECT set_config('app.user_id',   '<staff-user-id>', true);
--     SELECT set_config('app.actor_role','admin|advisor',   true);
--     SELECT set_config('app.admin_role','finance|...',     true);
-- (see withUserContext() in src/lib/db.ts — a no-op on the SQLite dev runtime).
--
-- Granular admin roles resolve as:
--   1. app.admin_role session setting when present;
--   2. else portal.staff_profiles.admin_role for the acting user;
--   3. else users.role ('admin' => 'super_admin' bootstrap, 'advisor' => 'advisor').
--
-- Posture (defense in depth beneath src/lib/admin/rbac.ts):
--   • staff_profiles           — staff read; only super admins mutate
--   • order_status_events      — staff read/insert (fulfilment writes)
--   • revenue_events           — finance / super_admin / analyst read;
--                                finance / super_admin write
--   • refund_adjustments       — finance / super_admin only
--   • compliance_reviews       — compliance / ops_lead / super_admin
--   • internal_notes           — staff read ('staff' visibility),
--                                super_admin reads 'admins' visibility
--   • content_meta             — staff read; ops_lead / content / super_admin
--                                mutate
--   • system_settings          — staff read; super_admin mutate
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Granular admin-role resolution
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.current_admin_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.admin_role', true), ''),
    (SELECT sp.admin_role::text FROM portal.staff_profiles sp
      WHERE sp.user_id = portal.current_user_id() AND sp.is_active),
    CASE
      WHEN portal.is_admin()  THEN 'super_admin'
      WHEN portal.is_staff()  THEN 'advisor'
      ELSE NULL
    END
  );
$$;

CREATE OR REPLACE FUNCTION portal.has_admin_role(roles TEXT[]) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT portal.current_admin_role() = ANY (roles);
$$;

CREATE OR REPLACE FUNCTION portal.is_super_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT portal.has_admin_role(ARRAY['super_admin']);
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS on the admin tables
-- -----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'staff_profiles','order_status_events','revenue_events','refund_adjustments',
    'compliance_reviews','internal_notes','content_meta','system_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE portal.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END; $$;

-- -----------------------------------------------------------------------------
-- staff_profiles
-- -----------------------------------------------------------------------------
CREATE POLICY staff_profiles_read ON portal.staff_profiles FOR SELECT
  USING (portal.is_staff());
CREATE POLICY staff_profiles_write ON portal.staff_profiles FOR ALL
  USING (portal.is_super_admin())
  WITH CHECK (portal.is_super_admin());

-- -----------------------------------------------------------------------------
-- order_status_events — fulfilment history: staff read + insert
-- -----------------------------------------------------------------------------
CREATE POLICY order_events_read ON portal.order_status_events FOR SELECT
  USING (portal.is_staff());
CREATE POLICY order_events_insert ON portal.order_status_events FOR INSERT
  WITH CHECK (portal.is_staff());

-- -----------------------------------------------------------------------------
-- revenue_events — recognition ledger
-- -----------------------------------------------------------------------------
CREATE POLICY revenue_events_read ON portal.revenue_events FOR SELECT
  USING (portal.has_admin_role(ARRAY['super_admin','finance','analyst','ops_lead']));
CREATE POLICY revenue_events_write ON portal.revenue_events FOR ALL
  USING (portal.has_admin_role(ARRAY['super_admin','finance']))
  WITH CHECK (portal.has_admin_role(ARRAY['super_admin','finance']));

-- -----------------------------------------------------------------------------
-- refund_adjustments — controlled refunds: finance / super admin only
-- -----------------------------------------------------------------------------
CREATE POLICY refunds_all ON portal.refund_adjustments FOR ALL
  USING (portal.has_admin_role(ARRAY['super_admin','finance']))
  WITH CHECK (portal.has_admin_role(ARRAY['super_admin','finance']));

-- -----------------------------------------------------------------------------
-- compliance_reviews
-- -----------------------------------------------------------------------------
CREATE POLICY compliance_reviews_read ON portal.compliance_reviews FOR SELECT
  USING (portal.has_admin_role(ARRAY['super_admin','compliance','ops_lead']));
CREATE POLICY compliance_reviews_insert ON portal.compliance_reviews FOR INSERT
  WITH CHECK (portal.has_admin_role(ARRAY['super_admin','compliance']));

-- -----------------------------------------------------------------------------
-- internal_notes — 'staff' visibility for all staff; 'admins' for super admin
-- -----------------------------------------------------------------------------
CREATE POLICY internal_notes_read ON portal.internal_notes FOR SELECT
  USING (
    portal.is_staff()
    AND (visibility = 'staff'::portal.note_visibility OR portal.is_super_admin())
  );
CREATE POLICY internal_notes_insert ON portal.internal_notes FOR INSERT
  WITH CHECK (portal.is_staff());

-- -----------------------------------------------------------------------------
-- content_meta — governance of Sanity-sourced inventory & intelligence
-- -----------------------------------------------------------------------------
CREATE POLICY content_meta_read ON portal.content_meta FOR SELECT
  USING (portal.is_staff());
CREATE POLICY content_meta_write ON portal.content_meta FOR ALL
  USING (portal.has_admin_role(ARRAY['super_admin','ops_lead','content']))
  WITH CHECK (portal.has_admin_role(ARRAY['super_admin','ops_lead','content']));

-- -----------------------------------------------------------------------------
-- system_settings
-- -----------------------------------------------------------------------------
CREATE POLICY system_settings_read ON portal.system_settings FOR SELECT
  USING (portal.is_staff());
CREATE POLICY system_settings_write ON portal.system_settings FOR ALL
  USING (portal.is_super_admin())
  WITH CHECK (portal.is_super_admin());

-- -----------------------------------------------------------------------------
-- Finance / analyst read access to orders, payments and mandates
-- (extending 002: coarse staff gate already grants advisor/admin; granular
--  roles all authenticate as users.role = 'admin', so is_staff() holds.)
-- -----------------------------------------------------------------------------
CREATE POLICY orders_finance_read ON portal.orders FOR SELECT
  USING (portal.is_staff());
CREATE POLICY payments_finance_read ON portal.payments FOR SELECT
  USING (portal.is_staff());

COMMIT;
