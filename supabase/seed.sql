-- ================================================================
-- Seed data for development testing
-- Middle East locations matching the 5 operating sites
-- ================================================================

-- Insert sample drones (after sites are created in migration)
INSERT INTO drones (id, drone_id, source_site_id, last_confirmed_latitude, last_confirmed_longitude, last_confirmed_altitude, heading, speed_mps, last_confirmed_at, simulation_started_at, simulation_status, is_active)
VALUES
  (
    'd0000000-0000-0000-0000-000000000001',
    'D-001',
    'a0000000-0000-0000-0000-000000000001', -- Cairo Command
    30.0500,
    31.2400,
    200,
    340,
    20,
    now() - interval '4 minutes',
    now() - interval '3 minutes',
    'simulating',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'D-002',
    'a0000000-0000-0000-0000-000000000002', -- Riyadh Hub
    24.7200,
    46.6800,
    150,
    84,
    12,
    now() - interval '8 minutes',
    now() - interval '8 minutes',
    'simulating',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'D-003',
    'a0000000-0000-0000-0000-000000000001', -- Cairo Command
    30.0300,
    31.2300,
    112,
    0,
    0,
    now() - interval '60 minutes',
    now() - interval '60 minutes',
    'stopped',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    'D-004',
    'a0000000-0000-0000-0000-000000000003', -- Dubai Station
    25.1000,
    54.9000,
    200,
    210,
    18,
    now() - interval '1 minute',
    now() - interval '1 minute',
    'simulating',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000005',
    'D-005',
    'a0000000-0000-0000-0000-000000000004', -- South Port / Jebel Ali
    25.2800,
    55.3000,
    80,
    315,
    8,
    now() - interval '45 minutes',
    now() - interval '45 minutes',
    'simulating',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000006',
    'D-006',
    'a0000000-0000-0000-0000-000000000002', -- Riyadh Hub
    24.7500,
    46.7000,
    95,
    45,
    15,
    now() - interval '4 minutes',
    now() - interval '4 minutes',
    'simulating',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000007',
    'D-007',
    'a0000000-0000-0000-0000-000000000005', -- Abu Dhabi Post
    24.4700,
    54.3800,
    175,
    270,
    22,
    now() - interval '3 minutes',
    now() - interval '3 minutes',
    'simulating',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000008',
    'D-008',
    'a0000000-0000-0000-0000-000000000003', -- Dubai Station
    25.2300,
    55.2800,
    300,
    180,
    10,
    now() - interval '2 minutes',
    now() - interval '2 minutes',
    'simulating',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000009',
    'D-009',
    'a0000000-0000-0000-0000-000000000001', -- Cairo Command
    30.0550,
    31.2450,
    50,
    120,
    5,
    now() - interval '25 minutes',
    NULL,
    'paused',
    true
  ),
  (
    'd0000000-0000-0000-0000-000000000010',
    'D-010',
    'a0000000-0000-0000-0000-000000000004', -- South Port / Jebel Ali
    25.2900,
    55.3100,
    250,
    0,
    0,
    now() - interval '90 minutes',
    NULL,
    'stopped',
    false
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample events for D-001
INSERT INTO drone_events (id, drone_id, event_type, site_id, data, created_at)
SELECT
  gen_random_uuid(),
  'd0000000-0000-0000-0000-000000000001',
  unnest(ARRAY['drone_created'::event_type, 'simulation_started'::event_type, 'drone_updated'::event_type, 'simulation_ended'::event_type, 'simulation_started'::event_type]),
  'a0000000-0000-0000-0000-000000000001',
  '{}'::jsonb,
  now() - interval '5 minutes' + (interval '30 seconds' * generate_series(0, 4))
ON CONFLICT DO NOTHING;

-- Insert sample alerts
INSERT INTO alerts (id, drone_id, alert_type, severity, title, message, created_at)
VALUES
  (
    gen_random_uuid(),
    'd0000000-0000-0000-0000-000000000005',
    'stale_data',
    'critical',
    'Drone D-005 Signal Loss',
    'Drone D-005 has not synced in 45 minutes near Jebel Ali port. Signal loss probable.',
    now() - interval '10 minutes'
  ),
  (
    gen_random_uuid(),
    NULL,
    'communication_warning',
    'warning',
    'Site 03 Latency Spike',
    'Dubai Station experiencing higher than normal latency (185ms).',
    now() - interval '20 minutes'
  ),
  (
    gen_random_uuid(),
    'd0000000-0000-0000-0000-000000000002',
    'drone_outside_zone',
    'warning',
    'Drone D-002 Approaching Boundary',
    'Drone D-002 is nearing the Riyadh operational zone boundary.',
    now() - interval '15 minutes'
  ),
  (
    gen_random_uuid(),
    NULL,
    'system',
    'info',
    'Routine Maintenance Window',
    'Scheduled maintenance at 03:00 UTC. Systems may be intermittent.',
    now() - interval '30 minutes'
  )
ON CONFLICT DO NOTHING;
