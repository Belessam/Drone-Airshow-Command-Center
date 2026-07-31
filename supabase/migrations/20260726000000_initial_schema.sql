-- ================================================================
-- Drone Airshow Command Center — Initial Schema
-- ================================================================
-- This migration creates the full production database structure.
--
-- Tables:
--   profiles         — Extended user profiles tied to auth.users
--   sites            — Operating sites with unique colors
--   drones           — Drone registry with confirmed state
--   drone_updates    — Manual user-submitted updates (append-only)
--   drone_simulation_segments — Archived simulation segments
--   drone_events     — Timeline events (audit log)
--   alerts           — System and data-freshness alerts
--
-- Indexes on frequently queried fields.
-- Row Level Security enabled with role-based policies.
-- Seed data for 5 operating sites.
-- ================================================================

-- ================================================================
-- CLEANUP — Safe to re-run if previous attempt partially executed
-- ================================================================

DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS drone_simulation_segments CASCADE;
DROP TABLE IF EXISTS drone_events CASCADE;
DROP TABLE IF EXISTS drone_updates CASCADE;
DROP TABLE IF EXISTS drones CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS sites CASCADE;

DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS alert_type CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS simulation_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- ================================================================
-- CUSTOM TYPES
-- ================================================================

CREATE TYPE user_role AS ENUM ('admin', 'site_operator', 'viewer');
CREATE TYPE simulation_status AS ENUM ('simulating', 'paused', 'stopped');
CREATE TYPE event_type AS ENUM (
  'drone_created',
  'drone_updated',
  'simulation_started',
  'simulation_ended',
  'heading_changed',
  'speed_changed',
  'altitude_changed',
  'alert_triggered',
  'alert_resolved'
);
CREATE TYPE alert_type AS ENUM (
  'stale_data',
  'site_offline',
  'communication_warning',
  'drone_outside_zone',
  'system'
);
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

-- ================================================================
-- SITES
-- ================================================================

CREATE TABLE sites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  radius_km     DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sites_code ON sites (code);
CREATE INDEX idx_sites_active ON sites (is_active);

-- ================================================================
-- PROFILES (extends auth.users)
-- ================================================================

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          user_role NOT NULL DEFAULT 'viewer',
  site_id       UUID REFERENCES sites(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles (role);
CREATE INDEX idx_profiles_site ON profiles (site_id);
CREATE INDEX idx_profiles_email ON profiles (email);

-- ================================================================
-- DRONES
-- ================================================================

CREATE TABLE drones (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id                  TEXT NOT NULL UNIQUE,
  source_site_id            UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  last_confirmed_latitude   DOUBLE PRECISION NOT NULL,
  last_confirmed_longitude  DOUBLE PRECISION NOT NULL,
  last_confirmed_altitude   DOUBLE PRECISION NOT NULL,
  heading                   DOUBLE PRECISION NOT NULL CHECK (heading >= 0 AND heading < 360),
  speed_mps                 DOUBLE PRECISION NOT NULL CHECK (speed_mps >= 0),
  last_confirmed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  simulation_started_at     TIMESTAMPTZ,
  simulation_status         simulation_status NOT NULL DEFAULT 'stopped',
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drones_source_site ON drones (source_site_id);
CREATE INDEX idx_drones_drone_id ON drones (drone_id);
CREATE INDEX idx_drones_status ON drones (simulation_status);
CREATE INDEX idx_drones_active ON drones (is_active);
CREATE INDEX idx_drones_last_confirmed ON drones (last_confirmed_at DESC);

-- ================================================================
-- DRONE UPDATES (append-only manual updates)
-- ================================================================

CREATE TABLE drone_updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id      UUID NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
  site_id       UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  altitude      DOUBLE PRECISION NOT NULL,
  heading       DOUBLE PRECISION NOT NULL CHECK (heading >= 0 AND heading < 360),
  speed_mps     DOUBLE PRECISION NOT NULL CHECK (speed_mps >= 0),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_updates_drone ON drone_updates (drone_id);
CREATE INDEX idx_updates_drone_created ON drone_updates (drone_id, created_at DESC);
CREATE INDEX idx_updates_site ON drone_updates (site_id);
CREATE INDEX idx_updates_user ON drone_updates (user_id);
CREATE INDEX idx_updates_created ON drone_updates (created_at DESC);

-- ================================================================
-- DRONE SIMULATION SEGMENTS
-- ================================================================

CREATE TABLE drone_simulation_segments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id              UUID NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
  started_at            TIMESTAMPTZ NOT NULL,
  ended_at              TIMESTAMPTZ,
  start_latitude        DOUBLE PRECISION NOT NULL,
  start_longitude       DOUBLE PRECISION NOT NULL,
  end_latitude          DOUBLE PRECISION,
  end_longitude         DOUBLE PRECISION,
  heading               DOUBLE PRECISION NOT NULL CHECK (heading >= 0 AND heading < 360),
  speed_mps             DOUBLE PRECISION NOT NULL CHECK (speed_mps >= 0),
  altitude              DOUBLE PRECISION NOT NULL,
  started_by_update_id  UUID REFERENCES drone_updates(id) ON DELETE SET NULL,
  ended_by_update_id    UUID REFERENCES drone_updates(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_segments_drone ON drone_simulation_segments (drone_id);
CREATE INDEX idx_segments_drone_ended ON drone_simulation_segments (drone_id, ended_at DESC NULLS FIRST);
CREATE INDEX idx_segments_active ON drone_simulation_segments (drone_id) WHERE ended_at IS NULL;

-- ================================================================
-- DRONE EVENTS (timeline / audit log)
-- ================================================================

CREATE TABLE drone_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id      UUID NOT NULL REFERENCES drones(id) ON DELETE CASCADE,
  event_type    event_type NOT NULL,
  site_id       UUID REFERENCES sites(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_drone ON drone_events (drone_id);
CREATE INDEX idx_events_drone_created ON drone_events (drone_id, created_at DESC);
CREATE INDEX idx_events_type ON drone_events (event_type);
CREATE INDEX idx_events_created ON drone_events (created_at DESC);
CREATE INDEX idx_events_site ON drone_events (site_id);

-- ================================================================
-- ALERTS
-- ================================================================

CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id      UUID REFERENCES drones(id) ON DELETE CASCADE,
  alert_type    alert_type NOT NULL,
  severity      alert_severity NOT NULL DEFAULT 'warning',
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  data          JSONB DEFAULT '{}'::jsonb,
  is_resolved   BOOLEAN NOT NULL DEFAULT false,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_unresolved ON alerts (is_resolved, created_at DESC) WHERE NOT is_resolved;
CREATE INDEX idx_alerts_severity ON alerts (severity, created_at DESC);
CREATE INDEX idx_alerts_drone ON alerts (drone_id);
CREATE INDEX idx_alerts_created ON alerts (created_at DESC);

-- ================================================================
-- TRIGGER FUNCTIONS
-- ================================================================

-- Auto-update updated_at on sites
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_drones_updated_at
  BEFORE UPDATE ON drones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'unknown'),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    'site_operator'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drones ENABLE ROW LEVEL SECURITY;
ALTER TABLE drone_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE drone_simulation_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drone_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- RLS POLICIES — SITES
-- ================================================================

-- All authenticated users can read sites
CREATE POLICY "Anyone can read sites"
  ON sites FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete sites
CREATE POLICY "Admins can insert sites"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can update sites"
  ON sites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Admins can delete sites"
  ON sites FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ================================================================
-- RLS POLICIES — PROFILES
-- ================================================================

-- Users can read their own profile; admins can read all
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Users can update their own profile
-- Admins can update any profile (including role)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ================================================================
-- RLS POLICIES — DRONES
-- ================================================================

-- All authenticated users can read drones
CREATE POLICY "Anyone can read drones"
  ON drones FOR SELECT
  TO authenticated
  USING (true);

-- Site operators and admins can insert drones
CREATE POLICY "Operators and admins can insert drones"
  ON drones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('admin', 'site_operator'))
    )
  );

-- Only admins can update source_site_id;
-- operators can update other fields for drones in their site
CREATE POLICY "Admins can update any drone"
  ON drones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Operators can update drones in their site"
  ON drones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'site_operator'
      AND profiles.site_id = drones.source_site_id
    )
  );

-- Admins can delete drones
CREATE POLICY "Admins can delete drones"
  ON drones FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Viewers cannot update/delete
-- (no update/delete policy = implicit deny)

-- ================================================================
-- RLS POLICIES — DRONE UPDATES
-- ================================================================

-- All authenticated users can read updates
CREATE POLICY "Anyone can read drone_updates"
  ON drone_updates FOR SELECT
  TO authenticated
  USING (true);

-- Site operators can insert updates for drones in their site
CREATE POLICY "Operators can insert updates for their site drones"
  ON drone_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'site_operator')
      AND (profiles.role = 'admin' OR profiles.site_id = drone_updates.site_id)
    )
  );

-- ================================================================
-- RLS POLICIES — SIMULATION SEGMENTS
-- ================================================================

-- All authenticated users can read segments
CREATE POLICY "Anyone can read simulation segments"
  ON drone_simulation_segments FOR SELECT
  TO authenticated
  USING (true);

-- Operators and admins can insert segments
CREATE POLICY "Operators and admins can insert segments"
  ON drone_simulation_segments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'site_operator')
    )
  );

-- ================================================================
-- RLS POLICIES — DRONE EVENTS
-- ================================================================

-- All authenticated users can read events
CREATE POLICY "Anyone can read drone_events"
  ON drone_events FOR SELECT
  TO authenticated
  USING (true);

-- System can insert events (via server-side)
-- For client-side: operators and admins can insert
CREATE POLICY "Operators and admins can insert events"
  ON drone_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'site_operator')
    )
  );

-- ================================================================
-- RLS POLICIES — ALERTS
-- ================================================================

-- All authenticated users can read alerts
CREATE POLICY "Anyone can read alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (true);

-- Operators and admins can insert alerts
CREATE POLICY "Operators and admins can insert alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'site_operator')
    )
  );

-- Operators and admins can update alerts (resolve them)
CREATE POLICY "Operators and admins can update alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'site_operator')
    )
  );

-- ================================================================
-- SEED DATA — 5 OPERATING SITES (Middle East — Egypt, KSA, UAE)
-- ================================================================

INSERT INTO sites (id, name, code, color, latitude, longitude, radius_km, description)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Cairo Command',
    'SITE-01',
    '#2F80ED',
    30.0444,
    31.2357,
    15.0,
    'Primary command center — Cairo, Egypt.'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Riyadh Hub',
    'SITE-02',
    '#27AE60',
    24.7136,
    46.6753,
    15.0,
    'Northern operations hub — Riyadh, KSA.'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Dubai Station',
    'SITE-03',
    '#F2994A',
    25.2048,
    55.2708,
    15.0,
    'Eastern surveillance station — Dubai, UAE.'
  ),
  (
    'a0000000-0000-0000-0000-000000000004',
    'South Port',
    'SITE-04',
    '#9B51E0',
    25.2867,
    55.2967,
    10.0,
    'Southern coastal entry point — Jebel Ali, Dubai.'
  ),
  (
    'a0000000-0000-0000-0000-000000000005',
    'Abu Dhabi Post',
    'SITE-05',
    '#56CCF2',
    24.4539,
    54.3773,
    10.0,
    'Western outpost — Abu Dhabi, UAE.'
  )
ON CONFLICT (id) DO NOTHING;
