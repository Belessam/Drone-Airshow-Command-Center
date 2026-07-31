-- ================================================================
-- Fix: Update existing site coordinates to correct Middle East locations
-- ================================================================
-- The initial migration used ON CONFLICT (id) DO NOTHING, so sites
-- created during the first run with LA coordinates still have those
-- wrong values. This migration UPSERTs the correct ME coordinates.
--
-- This is safe to re-run — it uses INSERT ... ON CONFLICT (id) DO UPDATE.
-- ================================================================

INSERT INTO sites (id, name, code, color, latitude, longitude, radius_km, description, is_active)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Cairo Command',
    'SITE-01',
    '#2F80ED',
    30.0444,
    31.2357,
    15.0,
    'Primary command center — Cairo, Egypt.',
    true
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Riyadh Hub',
    'SITE-02',
    '#27AE60',
    24.7136,
    46.6753,
    15.0,
    'Northern operations hub — Riyadh, KSA.',
    true
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Dubai Station',
    'SITE-03',
    '#F2994A',
    25.2048,
    55.2708,
    15.0,
    'Eastern surveillance station — Dubai, UAE.',
    true
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'South Port',
    'SITE-04',
    '#9B51E0',
    25.2867,
    55.2967,
    10.0,
    'Southern coastal entry point — Jebel Ali, Dubai.',
    true
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'Abu Dhabi Post',
    'SITE-05',
    '#56CCF2',
    24.4539,
    54.3773,
    10.0,
    'Western outpost — Abu Dhabi, UAE.',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  color = EXCLUDED.color,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  radius_km = EXCLUDED.radius_km,
  description = EXCLUDED.description,
  updated_at = now();

-- ================================================================
-- Fix: Assign admin profiles to their correct sites
-- ================================================================

UPDATE profiles SET site_id = 'a0000000-0000-0000-0000-000000000001' WHERE username = '815avenger' AND (site_id IS NULL OR site_id != 'a0000000-0000-0000-0000-000000000001');
UPDATE profiles SET site_id = 'a0000000-0000-0000-0000-000000000002' WHERE username = '817avenger' AND (site_id IS NULL OR site_id != 'a0000000-0000-0000-0000-000000000002');
UPDATE profiles SET site_id = 'a0000000-0000-0000-0000-000000000003' WHERE username = '821avenger' AND (site_id IS NULL OR site_id != 'a0000000-0000-0000-0000-000000000003');
UPDATE profiles SET site_id = 'a0000000-0000-0000-0000-000000000004' WHERE username = '586pechora' AND (site_id IS NULL OR site_id != 'a0000000-0000-0000-0000-000000000004');
UPDATE profiles SET site_id = 'a0000000-0000-0000-0000-000000000005' WHERE username = 'HARES' AND (site_id IS NULL OR site_id != 'a0000000-0000-0000-0000-000000000005');
