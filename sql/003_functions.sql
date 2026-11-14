-- =============================================================================
-- MURIVEST PRIVATE CAPITAL PORTAL — 003_functions.sql
-- Operational database functions & maintenance routines.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Bootstrap the first administrator.
-- The portal ships with NO users (no sample data). Create the first admin
-- with a scrypt hash produced by the app (src/lib/auth/password.ts
-- hashPassword()) or the management script scripts/hash-password.mjs.
--
--   SELECT portal.create_admin('office@murivest.com', '<scrypt-hash>', 'Full Name');
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.create_admin(p_email TEXT, p_password_hash TEXT, p_full_name TEXT)
RETURNS portal.users
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user portal.users;
BEGIN
  IF EXISTS (SELECT 1 FROM portal.users WHERE role IN ('admin','advisor')) THEN
    RAISE EXCEPTION 'Staff accounts already exist — use the application or portal.create_admin() while signed in as an admin.';
  END IF;

  INSERT INTO portal.users (id, email, password_hash, full_name, role, status, email_verified_at)
  VALUES ('usr-' || replace(gen_random_uuid()::text, '-', ''), lower(p_email), p_password_hash, p_full_name, 'admin', 'active', now())
  RETURNING * INTO v_user;

  INSERT INTO portal.investor_profiles (id, user_id, classification, verification_status, access_tier)
  VALUES ('prf-' || replace(gen_random_uuid()::text, '-', ''), v_user.id, 'individual', 'verified', 'tier_3');

  RETURN v_user;
END; $$;

-- -----------------------------------------------------------------------------
-- Purge expired sessions / auth tokens (schedule nightly via pg_cron or cron):
--   SELECT portal.purge_expired();
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.purge_expired() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM portal.sessions     WHERE expires_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM portal.auth_tokens  WHERE expires_at < now() - INTERVAL '30 days';
  RETURN v_count;
END; $$;

-- -----------------------------------------------------------------------------
-- Most-viewed opportunity intelligence: aggregated view counts across
-- authorised investors (drives the "high-interest" signal in Discover).
--   SELECT * FROM portal.most_viewed_opportunities(90);
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.most_viewed_opportunities(p_days INTEGER DEFAULT 90)
RETURNS TABLE (sanity_id TEXT, view_count BIGINT, distinct_investors BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT sanity_id, COUNT(*) AS view_count, COUNT(DISTINCT user_id) AS distinct_investors
  FROM portal.opportunity_views
  WHERE viewed_at > now() - (p_days || ' days')::interval
  GROUP BY sanity_id
  ORDER BY view_count DESC;
$$;

-- -----------------------------------------------------------------------------
-- Investor activity rollup for the Activity & Communications timeline.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.investor_activity(p_user_id TEXT, p_limit INTEGER DEFAULT 100)
RETURNS TABLE (kind TEXT, ref TEXT, title TEXT, occurred_at TIMESTAMPTZ)
LANGUAGE sql STABLE AS $$
  SELECT 'order'::text, reference::text, brief_title::text, created_at FROM portal.orders
    WHERE user_id = p_user_id
  UNION ALL
  SELECT 'enquiry', id, subject, created_at FROM portal.enquiries
    WHERE user_id = p_user_id
  UNION ALL
  SELECT 'mandate', reference, title, created_at FROM portal.mandates
    WHERE user_id = p_user_id
  UNION ALL
  SELECT 'document_view', sanity_document_id, COALESCE(document_title,'Document viewed'), created_at
    FROM portal.document_access_logs WHERE user_id = p_user_id
  UNION ALL
  SELECT 'scenario', id, name, updated_at FROM portal.scenarios
    WHERE user_id = p_user_id
  UNION ALL
  SELECT 'security_event', id, type, created_at FROM portal.security_events
    WHERE user_id = p_user_id
  ORDER BY occurred_at DESC
  LIMIT p_limit;
$$;

COMMIT;
