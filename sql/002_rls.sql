-- =============================================================================
-- MURIVEST PRIVATE CAPITAL PORTAL — 002_rls.sql
-- Row Level Security: investor-level data isolation enforced at the DATABASE
-- level (defense in depth beneath the application-layer guards in
-- src/lib/auth/guards.ts).
--
-- CONTEXT RESOLUTION
-- ------------------
-- The trusted Next.js server sets, per transaction:
--     SELECT set_config('app.user_id',  '<user-id>', true);
--     SELECT set_config('app.actor_role','advisor|admin', true);
-- (see withUserContext() in src/lib/db.ts — a no-op on the SQLite dev runtime.)
--
-- Supabase deployments: replace the body of portal.current_user_id() with
--   COALESCE(auth.uid()::text, NULLIF(current_setting('app.user_id', true),''))
-- so both PostgREST sessions and the app share the same policies.
--
-- Enforced posture:
--   • investors see ONLY rows they own
--   • advisors see rows of investors assigned to them (profile.advisor_id /
--     mandate.advisor_id) plus everything required for fulfilment
--   • admins see all
--   • audit.logs: insert allowed from app tier; SELECT restricted to admins
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.current_user_id() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::text;
$$;

CREATE OR REPLACE FUNCTION portal.current_actor_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.actor_role', true), ''),
    'user'
  )::text;
$$;

-- True when the acting context is the assigned advisor for this investor row
CREATE OR REPLACE FUNCTION portal.is_assigned_advisor(p_profile portal.investor_profiles) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT portal.current_actor_role() = 'advisor'
     AND EXISTS (SELECT 1 FROM portal.users u
                 WHERE u.id = portal.current_user_id()
                   AND u.role IN ('advisor','admin'))
     AND p_profile.advisor_id = portal.current_user_id();
$$;

CREATE OR REPLACE FUNCTION portal.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM portal.users u
                 WHERE u.id = portal.current_user_id() AND u.role = 'admin')
     OR portal.current_actor_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION portal.is_staff() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM portal.users u
                 WHERE u.id = portal.current_user_id() AND u.role IN ('advisor','admin'))
     OR portal.current_actor_role() IN ('advisor','admin');
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','sessions','auth_tokens','security_events',
    'organisations','organisation_members',
    'investor_profiles','investor_criteria',
    'saved_opportunities','opportunity_views','saved_searches',
    'scenarios','comparisons',
    'orders','payments','mandates','mandate_milestones',
    'enquiries','messages','notifications',
    'document_grants','document_access_logs','document_requests','nda_agreements',
    'portfolio_positions','capital_calls'
  ]
  LOOP
    EXECUTE format('ALTER TABLE portal.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
  EXECUTE 'ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY';
END; $$;

-- -----------------------------------------------------------------------------
-- Identity tables
-- -----------------------------------------------------------------------------
CREATE POLICY users_self_select ON portal.users FOR SELECT
  USING (id = portal.current_user_id() OR portal.is_staff());
CREATE POLICY users_self_update ON portal.users FOR UPDATE
  USING (id = portal.current_user_id())
  WITH CHECK (id = portal.current_user_id());

CREATE POLICY sessions_self ON portal.sessions FOR ALL
  USING (user_id = portal.current_user_id())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY auth_tokens_self ON portal.auth_tokens FOR ALL
  USING (user_id = portal.current_user_id())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY security_events_self ON portal.security_events FOR SELECT
  USING (user_id = portal.current_user_id());

-- -----------------------------------------------------------------------------
-- Organisations: visible to members; managed by organisation admins & staff
-- -----------------------------------------------------------------------------
CREATE POLICY organisations_member_select ON portal.organisations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM portal.organisation_members m
            WHERE m.organisation_id = id AND m.user_id = portal.current_user_id())
    OR portal.is_staff()
  );

CREATE POLICY org_members_select ON portal.organisation_members FOR SELECT
  USING (
    user_id = portal.current_user_id()
    OR EXISTS (SELECT 1 FROM portal.organisation_members me
               WHERE me.organisation_id = organisation_id
                 AND me.user_id = portal.current_user_id()
                 AND me.role = 'admin')
    OR portal.is_staff()
  );

-- -----------------------------------------------------------------------------
-- Profiles & criteria: owner, assigned advisor, admin
-- -----------------------------------------------------------------------------
CREATE POLICY profiles_owner ON portal.investor_profiles FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_assigned_advisor(portal.investor_profiles) OR portal.is_admin())
  WITH CHECK (user_id = portal.current_user_id() OR portal.is_admin());

CREATE POLICY criteria_owner ON portal.investor_criteria FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_admin())
  WITH CHECK (user_id = portal.current_user_id());

-- -----------------------------------------------------------------------------
-- Personal workspace (saves, views, searches, scenarios, comparisons)
-- -----------------------------------------------------------------------------
CREATE POLICY saved_opps_self ON portal.saved_opportunities FOR ALL
  USING (user_id = portal.current_user_id())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY opp_views_self ON portal.opportunity_views FOR ALL
  USING (user_id = portal.current_user_id())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY saved_searches_self ON portal.saved_searches FOR ALL
  USING (user_id = portal.current_user_id())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY scenarios_self ON portal.scenarios FOR ALL
  USING (user_id = portal.current_user_id())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY comparisons_self ON portal.comparisons FOR ALL
  USING (user_id = portal.current_user_id())
  WITH CHECK (user_id = portal.current_user_id());

-- -----------------------------------------------------------------------------
-- Orders & payments: owner; staff handle fulfilment
-- -----------------------------------------------------------------------------
CREATE POLICY orders_owner ON portal.orders FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_staff())
  WITH CHECK (user_id = portal.current_user_id() OR portal.is_staff());

CREATE POLICY payments_owner ON portal.payments FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_staff())
  WITH CHECK (user_id = portal.current_user_id() OR portal.is_staff());

-- -----------------------------------------------------------------------------
-- Mandates: owner, assigned advisor, admin
-- -----------------------------------------------------------------------------
CREATE POLICY mandates_owner ON portal.mandates FOR ALL
  USING (
    user_id = portal.current_user_id()
    OR advisor_id = portal.current_user_id()
    OR portal.is_admin()
  )
  WITH CHECK (user_id = portal.current_user_id() OR portal.is_admin());

CREATE POLICY mandate_milestones_access ON portal.mandate_milestones FOR ALL
  USING (
    EXISTS (SELECT 1 FROM portal.mandates m
            WHERE m.id = mandate_id
              AND (m.user_id = portal.current_user_id()
                   OR m.advisor_id = portal.current_user_id()
                   OR portal.is_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM portal.mandates m
            WHERE m.id = mandate_id
              AND (m.user_id = portal.current_user_id() OR portal.is_admin()))
  );

-- -----------------------------------------------------------------------------
-- Communications
-- -----------------------------------------------------------------------------
CREATE POLICY enquiries_owner ON portal.enquiries FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_staff())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY messages_owner ON portal.messages FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_staff())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY notifications_owner ON portal.notifications FOR ALL
  USING (user_id = portal.current_user_id())
  WITH CHECK (user_id = portal.current_user_id());

-- -----------------------------------------------------------------------------
-- Secure data room
-- -----------------------------------------------------------------------------
CREATE POLICY doc_grants_read ON portal.document_grants FOR SELECT
  USING (
    user_id = portal.current_user_id()
    OR (organisation_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM portal.organisation_members m
          WHERE m.organisation_id = document_grants.organisation_id
            AND m.user_id = portal.current_user_id()))
    OR granted_by_id = portal.current_user_id()
    OR portal.is_staff()
  );
CREATE POLICY doc_grants_manage ON portal.document_grants FOR INSERT
  WITH CHECK (portal.is_staff());
CREATE POLICY doc_grants_delete ON portal.document_grants FOR DELETE
  USING (portal.is_staff());

CREATE POLICY doc_access_logs_select ON portal.document_access_logs FOR SELECT
  USING (user_id = portal.current_user_id() OR portal.is_staff());
CREATE POLICY doc_access_logs_insert ON portal.document_access_logs FOR INSERT
  WITH CHECK (user_id = portal.current_user_id() OR portal.is_staff());

CREATE POLICY doc_requests_owner ON portal.document_requests FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_staff())
  WITH CHECK (user_id = portal.current_user_id());

CREATE POLICY nda_self ON portal.nda_agreements FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_admin())
  WITH CHECK (user_id = portal.current_user_id());

-- -----------------------------------------------------------------------------
-- Portfolio
-- -----------------------------------------------------------------------------
CREATE POLICY positions_owner ON portal.portfolio_positions FOR ALL
  USING (user_id = portal.current_user_id() OR portal.is_assigned_advisor(
           (SELECT p FROM portal.investor_profiles p WHERE p.user_id = portal.portfolio_positions.user_id LIMIT 1)
         ) OR portal.is_admin())
  WITH CHECK (user_id = portal.current_user_id() OR portal.is_admin());

CREATE POLICY capital_calls_owner ON portal.capital_calls FOR ALL
  USING (
    EXISTS (SELECT 1 FROM portal.portfolio_positions pos
            WHERE pos.id = position_id
              AND (pos.user_id = portal.current_user_id() OR portal.is_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM portal.portfolio_positions pos
            WHERE pos.id = position_id
              AND (pos.user_id = portal.current_user_id() OR portal.is_admin()))
  );

-- -----------------------------------------------------------------------------
-- Audit trail: inserts from the app tier (incl. triggers) are always allowed;
-- reads restricted to staff.
-- -----------------------------------------------------------------------------
CREATE POLICY audit_logs_insert ON audit.logs FOR INSERT WITH CHECK (true);
CREATE POLICY audit_logs_select ON audit.logs FOR SELECT USING (portal.is_staff());

COMMIT;
