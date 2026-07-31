import type { Site, Drone, DroneUpdate, DroneSimulationSegment, DroneEvent, Alert } from '@/types'

/**
 * Mock sites — these must match the DEMO_SITES in demoMode.ts for consistency.
 * Drone data uses real GPS coordinates around the Middle East sites.
 */

export const mockSites: Site[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'SITE-01', code: 'SITE-01', color: '#2F80ED', latitude: 30.0444, longitude: 31.2357, radius_km: 15.0, description: 'Primary operations center.', is_active: true, gps_accuracy: 5.0, location_verified: true, location_verified_at: '2026-07-01T00:00:00Z', address: 'Sector Alpha', created_at: '2026-07-26T10:00:00Z', updated_at: '2026-07-26T10:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'SITE-02', code: 'SITE-02', color: '#27AE60', latitude: 24.7136, longitude: 46.6753, radius_km: 15.0, description: 'Northern operations hub.', is_active: true, gps_accuracy: 5.0, location_verified: true, location_verified_at: '2026-07-01T00:00:00Z', address: 'Sector Bravo', created_at: '2026-07-26T10:00:00Z', updated_at: '2026-07-26T10:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'SITE-03', code: 'SITE-03', color: '#F2994A', latitude: 25.2048, longitude: 55.2708, radius_km: 15.0, description: 'Eastern surveillance station.', is_active: true, gps_accuracy: 5.0, location_verified: true, location_verified_at: '2026-07-01T00:00:00Z', address: 'Sector Charlie', created_at: '2026-07-26T10:00:00Z', updated_at: '2026-07-26T10:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'SITE-04', code: 'SITE-04', color: '#9B51E0', latitude: 25.2867, longitude: 55.2967, radius_km: 10.0, description: 'Southern coastal entry point.', is_active: true, gps_accuracy: 10.0, location_verified: true, location_verified_at: '2026-07-01T00:00:00Z', address: 'Sector Delta', created_at: '2026-07-26T10:00:00Z', updated_at: '2026-07-26T10:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'SITE-05', code: 'SITE-05', color: '#56CCF2', latitude: 24.4539, longitude: 54.3773, radius_km: 10.0, description: 'Western outpost.', is_active: true, gps_accuracy: 10.0, location_verified: true, location_verified_at: '2026-07-01T00:00:00Z', address: 'Sector Echo', created_at: '2026-07-26T10:00:00Z', updated_at: '2026-07-26T10:00:00Z' },
]

// Relative timestamp helper: returns an ISO string N seconds ago from module load time
const _modTime = Date.now()
function ago(seconds: number): string {
  return new Date(_modTime - seconds * 1000).toISOString()
}

/**
 * Drones with real GPS coordinates distributed across the Middle East region.
 * Timestamps are relative to module load so simulation engine produces
 * realistic movement from the start.
 */
export const mockDrones: Drone[] = [
  // D-001: Site 01 area patrol — actively simulating
  { id: 'd-001', drone_id: 'D-001', source_site_id: 'a0000000-0000-0000-0000-000000000001', last_confirmed_latitude: 30.0500, last_confirmed_longitude: 31.2400, last_confirmed_altitude: 200, heading: 340, speed_mps: 20, last_confirmed_at: ago(30), simulation_started_at: ago(30), simulation_status: 'simulating', is_active: true, created_at: ago(3600), updated_at: ago(30) },
  // D-002: Site 02 area patrol
  { id: 'd-002', drone_id: 'D-002', source_site_id: 'a0000000-0000-0000-0000-000000000002', last_confirmed_latitude: 24.7200, last_confirmed_longitude: 46.6800, last_confirmed_altitude: 150, heading: 84, speed_mps: 12, last_confirmed_at: ago(60), simulation_started_at: ago(60), simulation_status: 'simulating', is_active: true, created_at: ago(3600), updated_at: ago(60) },
  // D-003: Site 01 area — stopped
  { id: 'd-003', drone_id: 'D-003', source_site_id: 'a0000000-0000-0000-0000-000000000001', last_confirmed_latitude: 30.0300, last_confirmed_longitude: 31.2300, last_confirmed_altitude: 112, heading: 0, speed_mps: 0, last_confirmed_at: ago(120), simulation_started_at: null, simulation_status: 'stopped', is_active: true, created_at: ago(7200), updated_at: ago(120) },
  // D-004: Site 03 area transit
  { id: 'd-004', drone_id: 'D-004', source_site_id: 'a0000000-0000-0000-0000-000000000003', last_confirmed_latitude: 25.1000, last_confirmed_longitude: 54.9000, last_confirmed_altitude: 200, heading: 210, speed_mps: 18, last_confirmed_at: ago(15), simulation_started_at: ago(15), simulation_status: 'simulating', is_active: true, created_at: ago(3600), updated_at: ago(15) },
  // D-005: Site 04 area patrol — STALE
  { id: 'd-005', drone_id: 'D-005', source_site_id: 'a0000000-0000-0000-0000-000000000004', last_confirmed_latitude: 25.2800, last_confirmed_longitude: 55.3000, last_confirmed_altitude: 80, heading: 315, speed_mps: 8, last_confirmed_at: ago(720), simulation_started_at: ago(720), simulation_status: 'simulating', is_active: true, created_at: ago(7200), updated_at: ago(720) },
  // D-006: Site 02 north patrol
  { id: 'd-006', drone_id: 'D-006', source_site_id: 'a0000000-0000-0000-0000-000000000002', last_confirmed_latitude: 24.7500, last_confirmed_longitude: 46.7000, last_confirmed_altitude: 95, heading: 45, speed_mps: 15, last_confirmed_at: ago(40), simulation_started_at: ago(40), simulation_status: 'simulating', is_active: true, created_at: ago(3600), updated_at: ago(40) },
  // D-007: Site 05 coastal patrol
  { id: 'd-007', drone_id: 'D-007', source_site_id: 'a0000000-0000-0000-0000-000000000005', last_confirmed_latitude: 24.4700, last_confirmed_longitude: 54.3800, last_confirmed_altitude: 175, heading: 270, speed_mps: 22, last_confirmed_at: ago(20), simulation_started_at: ago(20), simulation_status: 'simulating', is_active: true, created_at: ago(3600), updated_at: ago(20) },
  // D-008: Site 03 airspace patrol
  { id: 'd-008', drone_id: 'D-008', source_site_id: 'a0000000-0000-0000-0000-000000000003', last_confirmed_latitude: 25.2300, last_confirmed_longitude: 55.2800, last_confirmed_altitude: 300, heading: 180, speed_mps: 10, last_confirmed_at: ago(50), simulation_started_at: ago(50), simulation_status: 'simulating', is_active: true, created_at: ago(3600), updated_at: ago(50) },
  // D-009: Site 01 — paused
  { id: 'd-009', drone_id: 'D-009', source_site_id: 'a0000000-0000-0000-0000-000000000001', last_confirmed_latitude: 30.0550, last_confirmed_longitude: 31.2450, last_confirmed_altitude: 50, heading: 120, speed_mps: 5, last_confirmed_at: ago(180), simulation_started_at: null, simulation_status: 'paused', is_active: true, created_at: ago(7200), updated_at: ago(180) },
  // D-010: Site 04 — inactive
  { id: 'd-010', drone_id: 'D-010', source_site_id: 'a0000000-0000-0000-0000-000000000004', last_confirmed_latitude: 25.2900, last_confirmed_longitude: 55.3100, last_confirmed_altitude: 250, heading: 0, speed_mps: 0, last_confirmed_at: ago(600), simulation_started_at: null, simulation_status: 'stopped', is_active: false, created_at: ago(14400), updated_at: ago(600) },
]

export const mockUpdates: DroneUpdate[] = [
  { id: 'upd-001', drone_id: 'd-001', site_id: 'a0000000-0000-0000-0000-000000000001', user_id: null, latitude: 30.0500, longitude: 31.2400, altitude: 200, heading: 340, speed_mps: 20, notes: 'Initial detection by Site 01.', created_at: ago(3600) },
  { id: 'upd-002', drone_id: 'd-001', site_id: 'a0000000-0000-0000-0000-000000000001', user_id: null, latitude: 30.0500, longitude: 31.2400, altitude: 200, heading: 340, speed_mps: 20, notes: 'Manual position adjustment — Site 01 Sector.', created_at: ago(1800) },
  { id: 'upd-003', drone_id: 'd-001', site_id: 'a0000000-0000-0000-0000-000000000001', user_id: null, latitude: 30.0480, longitude: 31.2380, altitude: 210, heading: 345, speed_mps: 22, notes: 'Altitude and heading tweak.', created_at: ago(30) },
]

export const mockSegments: DroneSimulationSegment[] = [
  { id: 'seg-001', drone_id: 'd-001', started_at: ago(3600), ended_at: ago(1800), start_latitude: 30.0500, start_longitude: 31.2400, end_latitude: 30.0505, end_longitude: 31.2403, heading: 340, speed_mps: 20, altitude: 200, started_by_update_id: 'upd-001', ended_by_update_id: 'upd-002', created_at: ago(3600) },
  { id: 'seg-002', drone_id: 'd-001', started_at: ago(1800), ended_at: null, start_latitude: 30.0505, start_longitude: 31.2403, end_latitude: null, end_longitude: null, heading: 340, speed_mps: 20, altitude: 200, started_by_update_id: 'upd-002', ended_by_update_id: null, created_at: ago(1800) },
]

export const mockEvents: DroneEvent[] = [
  { id: 'evt-001', drone_id: 'd-001', event_type: 'drone_created', site_id: 'a0000000-0000-0000-0000-000000000001', user_id: null, data: { heading: 340, speed: 20, altitude: 200, latitude: 30.0500, longitude: 31.2400 }, created_at: ago(3600) },
  { id: 'evt-002', drone_id: 'd-001', event_type: 'simulation_started', site_id: 'a0000000-0000-0000-0000-000000000001', user_id: null, data: { heading: 340, speed: 20, altitude: 200 }, created_at: ago(3600) },
  { id: 'evt-003', drone_id: 'd-001', event_type: 'drone_updated', site_id: 'a0000000-0000-0000-0000-000000000001', user_id: null, data: { heading: 340, speed: 20, altitude: 200 }, created_at: ago(1800) },
  { id: 'evt-004', drone_id: 'd-001', event_type: 'simulation_ended', site_id: 'a0000000-0000-0000-0000-000000000001', user_id: null, data: { ended_at: ago(1800) }, created_at: ago(1800) },
  { id: 'evt-005', drone_id: 'd-001', event_type: 'simulation_started', site_id: 'a0000000-0000-0000-0000-000000000001', user_id: null, data: { heading: 340, speed: 20, altitude: 200 }, created_at: ago(30) },
  { id: 'evt-006', drone_id: 'd-002', event_type: 'drone_created', site_id: 'a0000000-0000-0000-0000-000000000002', user_id: null, data: { heading: 84, speed: 12, altitude: 150, latitude: 24.7200, longitude: 46.6800 }, created_at: ago(3600) },
  { id: 'evt-007', drone_id: 'd-002', event_type: 'heading_changed', site_id: 'a0000000-0000-0000-0000-000000000002', user_id: null, data: { from: 80, to: 84 }, created_at: ago(3000) },
]

export const mockAlerts: Alert[] = [
  { id: 'alt-001', drone_id: 'd-005', alert_type: 'stale_data', severity: 'critical', title: 'Drone D-005 Signal Loss', message: "Drone D-005 hasn't synced in 12m near Site 04. Signal loss probable in Sector 4.", data: null, is_resolved: false, resolved_at: null, created_at: ago(300) },
  { id: 'alt-002', drone_id: null, alert_type: 'communication_warning', severity: 'warning', title: 'Site 03 Latency Spike', message: 'Site 03 experiencing higher than normal latency (185ms).', data: null, is_resolved: false, resolved_at: null, created_at: ago(600) },
  { id: 'alt-003', drone_id: 'd-002', alert_type: 'drone_outside_zone', severity: 'warning', title: 'Drone D-002 Approaching Boundary', message: 'Drone D-002 is nearing the Site 02 operational zone boundary.', data: null, is_resolved: false, resolved_at: null, created_at: ago(300) },
  { id: 'alt-004', drone_id: null, alert_type: 'system', severity: 'info', title: 'Routine Maintenance Window', message: 'Scheduled maintenance at 03:00 UTC. Systems may be intermittent.', data: null, is_resolved: false, resolved_at: null, created_at: ago(600) },
]

export function getSiteById(siteId: string): Site | undefined {
  return mockSites.find((s) => s.id === siteId)
}

export function getDroneById(droneId: string): Drone | undefined {
  return mockDrones.find((d) => d.id === droneId || d.drone_id === droneId)
}

export function getDronesBySite(siteId: string): Drone[] {
  return mockDrones.filter((d) => d.source_site_id === siteId)
}

export function getActiveDrones(): Drone[] {
  return mockDrones.filter((d) => d.is_active)
}

export function getDroneEvents(droneId: string): DroneEvent[] {
  return mockEvents.filter((e) => e.drone_id === droneId)
}
