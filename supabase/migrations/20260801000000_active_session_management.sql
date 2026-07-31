-- ================================================================
-- Active Session Management System
-- ================================================================
-- Supports multiple simultaneous logins per account.
-- Device fingerprint, heartbeat, blocking, and login history.
-- ================================================================

-- ─── Device Registry ───
-- Tracks known devices by fingerprint hash
CREATE TABLE IF NOT EXISTS session_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       TEXT NOT NULL UNIQUE,  -- SHA-256 fingerprint hash
  device_name     TEXT NOT NULL DEFAULT 'Unknown Device',
  browser         TEXT,
  browser_version TEXT,
  os              TEXT,
  platform        TEXT,
  language        TEXT,
  timezone        TEXT,
  screen_resolution TEXT,
  user_agent      TEXT,
  first_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_blocked      BOOLEAN NOT NULL DEFAULT false,
  blocked_at      TIMESTAMPTZ,
  blocked_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_devices_device_id ON session_devices (device_id);
CREATE INDEX IF NOT EXISTS idx_session_devices_blocked ON session_devices (is_blocked) WHERE is_blocked = true;

-- ─── Active Sessions ───
-- One row per active login session
CREATE TABLE IF NOT EXISTS active_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL REFERENCES session_devices(device_id) ON DELETE CASCADE,
  session_token   TEXT NOT NULL UNIQUE,  -- server-generated bearer token
  ip_address      TEXT,
  country         TEXT,
  city            TEXT,
  login_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_page    TEXT DEFAULT '/dashboard',
  status          TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'idle', 'offline')),
  is_revoked      BOOLEAN NOT NULL DEFAULT false,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_device ON active_sessions (device_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_status ON active_sessions (status);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON active_sessions (user_id, is_revoked) WHERE is_revoked = false;

-- ─── Login History ───
-- Append-only log of all authentication events
CREATE TABLE IF NOT EXISTS login_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  username        TEXT,
  event_type      TEXT NOT NULL CHECK (event_type IN ('login', 'logout', 'forced_logout', 'blocked', 'failed_login')),
  device_id       TEXT REFERENCES session_devices(device_id) ON DELETE SET NULL,
  device_name     TEXT,
  ip_address      TEXT,
  browser         TEXT,
  country         TEXT,
  city            TEXT,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history (user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_device ON login_history (device_id);
CREATE INDEX IF NOT EXISTS idx_login_history_type ON login_history (event_type);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history (created_at DESC);

-- ─── Heartbeat Logs ───
-- Periodic session health (purged after 7 days)
CREATE TABLE IF NOT EXISTS heartbeat_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES active_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_page    TEXT,
  status          TEXT NOT NULL DEFAULT 'online',
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_session ON heartbeat_logs (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_heartbeat_cleanup ON heartbeat_logs (created_at) WHERE created_at < now() - interval '7 days';

-- ─── RLS Policies ───

ALTER TABLE session_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeat_logs ENABLE ROW LEVEL SECURITY;

-- session_devices: users see their own devices, master admin sees all
CREATE POLICY "Users can view their own devices"
  ON session_devices FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM active_sessions
      WHERE active_sessions.device_id = session_devices.device_id
      AND active_sessions.user_id = auth.uid()
      AND active_sessions.is_revoked = false
    )
    OR get_current_user_role() = 'master_admin'
  );

CREATE POLICY "Users can insert their device"
  ON session_devices FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Master admin can block/unblock devices"
  ON session_devices FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'master_admin')
  WITH CHECK (get_current_user_role() = 'master_admin');

-- active_sessions: users see own, master admin sees all
CREATE POLICY "Users can view own sessions"
  ON active_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_current_user_role() = 'master_admin');

CREATE POLICY "Users can insert own sessions"
  ON active_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions (heartbeat)"
  ON active_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR get_current_user_role() = 'master_admin')
  WITH CHECK (user_id = auth.uid() OR get_current_user_role() = 'master_admin');

CREATE POLICY "Master admin can revoke any session"
  ON active_sessions FOR DELETE TO authenticated
  USING (get_current_user_role() = 'master_admin');

-- login_history: users see own, master admin sees all
CREATE POLICY "Users can view own login history"
  ON login_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_current_user_role() = 'master_admin');

CREATE POLICY "System can insert login history"
  ON login_history FOR INSERT TO authenticated
  WITH CHECK (true);

-- heartbeat_logs: users see own, master admin sees all
CREATE POLICY "Users can view own heartbeats"
  ON heartbeat_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_current_user_role() = 'master_admin');

CREATE POLICY "System can insert heartbeats"
  ON heartbeat_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ─── Auto-cleanup old heartbeat logs ───
-- Run via pg_cron or a scheduled edge function
-- DELETE FROM heartbeat_logs WHERE created_at < now() - interval '7 days';
