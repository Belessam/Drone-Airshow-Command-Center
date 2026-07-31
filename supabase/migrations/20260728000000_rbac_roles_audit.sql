-- ================================================================
-- RBAC: Add master_admin to user_role enum, add audit_log table
-- ================================================================

-- Add master_admin to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'master_admin' BEFORE 'admin';

-- ================================================================
-- AUDIT LOG
-- ================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only master_admin can read audit logs
CREATE POLICY "Master admins can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'master_admin');

-- Authenticated users can insert audit logs (server-side)
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- UPDATED RLS POLICIES FOR ALL 4 ROLES
-- ================================================================

-- DROP EXISTING POLICIES FIRST (to recreate with new role checks)
DROP POLICY IF EXISTS "Admins can insert sites" ON sites;
DROP POLICY IF EXISTS "Admins can update sites" ON sites;
DROP POLICY IF EXISTS "Admins can delete sites" ON sites;
DROP POLICY IF EXISTS "Operators and admins can insert drones" ON drones;
DROP POLICY IF EXISTS "Admins can update any drone" ON drones;
DROP POLICY IF EXISTS "Operators can update drones in their site" ON drones;
DROP POLICY IF EXISTS "Admins can delete drones" ON drones;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Operators can insert updates for their site drones" ON drone_updates;
DROP POLICY IF EXISTS "Operators and admins can insert segments" ON drone_simulation_segments;
DROP POLICY IF EXISTS "Operators and admins can insert events" ON drone_events;
DROP POLICY IF EXISTS "Operators and admins can insert alerts" ON alerts;
DROP POLICY IF EXISTS "Operators and admins can update alerts" ON alerts;

-- ================================================================
-- SITES
-- ================================================================

-- Only master_admin can insert/update/delete sites
CREATE POLICY "Master admin can insert sites"
  ON sites FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'master_admin');

CREATE POLICY "Master admin can update sites"
  ON sites FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'master_admin');

CREATE POLICY "Master admin can delete sites"
  ON sites FOR DELETE TO authenticated
  USING (get_current_user_role() = 'master_admin');

-- ================================================================
-- DRONES
-- ================================================================

-- Master admin + admin can insert drones
CREATE POLICY "Master admin and admin can insert drones"
  ON drones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND get_current_user_role() IN ('master_admin', 'admin'))
  );

-- Master admin + admin can update any drone
CREATE POLICY "Master admin and admin can update any drone"
  ON drones FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND get_current_user_role() IN ('master_admin', 'admin'))
  );

-- Site operators can update drones assigned to their site
CREATE POLICY "Operators can update drones in their site"
  ON drones FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'site_operator' AND profiles.site_id = drones.source_site_id)
  );

-- Master admin can delete any drone; admin can only delete drones from their own site
DROP POLICY IF EXISTS "Master admin and admin can delete drones" ON drones;
CREATE POLICY "Master admin can delete any drone"
  ON drones FOR DELETE TO authenticated
  USING (
    get_current_user_role() = 'master_admin'
  );

CREATE POLICY "Admin can delete drones from their site"
  ON drones FOR DELETE TO authenticated
  USING (
    get_current_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.site_id = drones.source_site_id
    )
  );

-- ================================================================
-- PROFILES
-- ================================================================

-- Create a security definer function to check the current user's role
-- without triggering recursive RLS evaluation on profiles
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::text FROM profiles WHERE id = auth.uid();
$$;

-- Master admin can read all profiles; users can read own
-- Uses get_current_user_role() to avoid recursive RLS
DROP POLICY IF EXISTS "Master admin can read all profiles" ON profiles;
CREATE POLICY "Master admin can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR
    get_current_user_role() = 'master_admin'
  );

-- Users can update their own profile (non-role fields)
-- Master admin can update any profile (including role)
DROP POLICY IF EXISTS "Users and master admin can update profiles" ON profiles;
CREATE POLICY "Users and master admin can update profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR get_current_user_role() = 'master_admin'
  );

-- ================================================================
-- DRONE UPDATES
-- ================================================================

-- Master admin + admin can insert updates
CREATE POLICY "Master admin and admin can insert updates"
  ON drone_updates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND get_current_user_role() IN ('master_admin', 'admin'))
  );

-- Site operators can insert updates for their site's drones
CREATE POLICY "Operators can insert updates for their site"
  ON drone_updates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'site_operator' AND profiles.site_id = drone_updates.site_id)
  );

-- ================================================================
-- SIMULATION SEGMENTS
-- ================================================================

-- Master admin + admin can insert segments
CREATE POLICY "Master admin and admin can insert segments"
  ON drone_simulation_segments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND get_current_user_role() IN ('master_admin', 'admin'))
  );

-- Site operators can insert segments
CREATE POLICY "Operators can insert segments"
  ON drone_simulation_segments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'site_operator')
  );

-- ================================================================
-- DRONE EVENTS
-- ================================================================

-- All write-capable roles can insert events
CREATE POLICY "Write-capable roles can insert events"
  ON drone_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND get_current_user_role() IN ('master_admin', 'admin', 'site_operator'))
  );

-- ================================================================
-- ALERTS
-- ================================================================

-- Write-capable roles can insert alerts
CREATE POLICY "Write-capable roles can insert alerts"
  ON alerts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND get_current_user_role() IN ('master_admin', 'admin', 'site_operator'))
  );

-- Write-capable roles can update alerts (resolve them)
CREATE POLICY "Write-capable roles can update alerts"
  ON alerts FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND get_current_user_role() IN ('master_admin', 'admin', 'site_operator'))
  );
