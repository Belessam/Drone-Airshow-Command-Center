/**
 * Generated types matching the Supabase schema exactly.
 * These mirror the migration SQL for type-safe queries.
 */

export interface Json {
  [key: string]: unknown
}

export type UserRole = 'master_admin' | 'admin' | 'site_operator' | 'viewer'
export type SimulationStatus = 'simulating' | 'paused' | 'stopped'
export type EventType =
  | 'drone_created'
  | 'drone_updated'
  | 'simulation_started'
  | 'simulation_ended'
  | 'heading_changed'
  | 'speed_changed'
  | 'altitude_changed'
  | 'alert_triggered'
  | 'alert_resolved'
export type AlertType =
  | 'stale_data'
  | 'site_offline'
  | 'communication_warning'
  | 'drone_outside_zone'
  | 'system'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface DbSite {
  id: string
  name: string
  code: string
  color: string
  latitude: number
  longitude: number
  radius_km: number
  description: string | null
  is_active: boolean
  gps_accuracy: number | null
  location_verified: boolean
  location_verified_at: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface DbProfile {
  id: string
  email: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  site_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbDrone {
  id: string
  drone_id: string
  source_site_id: string
  last_confirmed_latitude: number
  last_confirmed_longitude: number
  last_confirmed_altitude: number
  heading: number
  speed_mps: number
  last_confirmed_at: string
  simulation_started_at: string | null
  simulation_status: SimulationStatus
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbDroneUpdate {
  id: string
  drone_id: string
  site_id: string
  user_id: string | null
  latitude: number
  longitude: number
  altitude: number
  heading: number
  speed_mps: number
  notes: string | null
  created_at: string
}

export interface DbDroneSimulationSegment {
  id: string
  drone_id: string
  started_at: string
  ended_at: string | null
  start_latitude: number
  start_longitude: number
  end_latitude: number | null
  end_longitude: number | null
  heading: number
  speed_mps: number
  altitude: number
  started_by_update_id: string | null
  ended_by_update_id: string | null
  created_at: string
}

export interface DbDroneEvent {
  id: string
  drone_id: string
  event_type: EventType
  site_id: string | null
  user_id: string | null
  data: Json
  created_at: string
}

export interface DbAlert {
  id: string
  drone_id: string | null
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  data: Json | null
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      sites: { Row: DbSite; Insert: Omit<DbSite, 'id' | 'created_at' | 'updated_at'>; Update: Partial<DbSite> }
      profiles: { Row: DbProfile; Insert: Omit<DbProfile, 'id' | 'created_at' | 'updated_at'>; Update: Partial<DbProfile> }
      drones: { Row: DbDrone; Insert: Omit<DbDrone, 'id' | 'created_at' | 'updated_at'>; Update: Partial<DbDrone> }
      drone_updates: { Row: DbDroneUpdate; Insert: Omit<DbDroneUpdate, 'id' | 'created_at'>; Update: Partial<DbDroneUpdate> }
      drone_simulation_segments: { Row: DbDroneSimulationSegment; Insert: Omit<DbDroneSimulationSegment, 'id' | 'created_at'>; Update: Partial<DbDroneSimulationSegment> }
      drone_events: { Row: DbDroneEvent; Insert: Omit<DbDroneEvent, 'id' | 'created_at'>; Update: Partial<DbDroneEvent> }
      alerts: { Row: DbAlert; Insert: Omit<DbAlert, 'id' | 'created_at'>; Update: Partial<DbAlert> }
    }
    Enums: {
      user_role: UserRole
      simulation_status: SimulationStatus
      event_type: EventType
      alert_type: AlertType
      alert_severity: AlertSeverity
    }
  }
}
