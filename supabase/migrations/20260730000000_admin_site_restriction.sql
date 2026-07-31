-- ================================================================
-- Migration: Enforce admin site_id restriction on drone INSERT
-- ================================================================
--
-- Regular admin users can ONLY register drones under their own
-- assigned site_id. Master Admin can register under any site.
--
-- This policy prevents admin users from inserting drones into
-- sites they don't belong to, even through direct API calls.
--
-- Changes:
--   1. DROP the existing "Master admin and admin can insert drones" policy
--      (which allowed any admin to insert into any site)
--   2. CREATE a replacement policy that checks:
--      - Master admin can insert into ANY site
--      - Regular admin can ONLY insert when source_site_id == profiles.site_id
--      - site_operator can ONLY insert into their assigned site
-- ================================================================

DROP POLICY IF EXISTS "Master admin and admin can insert drones" ON drones;

CREATE POLICY "Admin can insert drones with site restriction"
  ON drones FOR INSERT TO authenticated
  WITH CHECK (
    -- Master admin: can insert into ANY site
    get_current_user_role() = 'master_admin'
    OR
    -- Regular admin: can ONLY insert into their assigned site
    (
      get_current_user_role() = 'admin'
      AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.site_id = drones.source_site_id
      )
    )
    OR
    -- Site operator: can ONLY insert into their assigned site
    (
      get_current_user_role() = 'site_operator'
      AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.site_id = drones.source_site_id
      )
    )
  );
