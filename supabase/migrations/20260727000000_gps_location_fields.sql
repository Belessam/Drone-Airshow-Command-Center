-- ================================================================
-- Add GPS location fields to sites table
-- ================================================================

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS gps_accuracy DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address TEXT;
