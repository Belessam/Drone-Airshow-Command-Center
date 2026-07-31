export type SiteColor = string

export interface Site {
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

export type SimulationStatus = 'simulating' | 'paused' | 'stopped'

export interface Drone {
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

export interface DroneWithSite extends Drone {
  source_site: Site
  current_estimated_latitude?: number
  current_estimated_longitude?: number
  estimated_altitude?: number
}

export interface DroneUpdate {
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

export interface DroneUpdateWithUser extends DroneUpdate {
  profiles?: {
    full_name: string | null
    site_id: string | null
  } | null
  site?: Site | null
}

export interface DroneSimulationSegment {
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

export interface DroneEvent {
  id: string
  drone_id: string
  event_type: EventType
  site_id: string | null
  user_id: string | null
  data: Record<string, unknown>
  created_at: string
}

export interface DroneEventWithRelations extends DroneEvent {
  profiles?: {
    full_name: string | null
  } | null
  site?: Site | null
}

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

export interface Alert {
  id: string
  drone_id: string | null
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  data: Record<string, unknown> | null
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
}

export type AlertType =
  | 'stale_data'
  | 'site_offline'
  | 'communication_warning'
  | 'drone_outside_zone'
  | 'system'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type DataFreshness = 'fresh' | 'recent' | 'stale' | 'critical'

export interface Profile {
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

export type UserRole = 'master_admin' | 'admin' | 'site_operator' | 'viewer'

export interface FreshnessConfig {
  fresh_threshold_seconds: number
  recent_threshold_seconds: number
  stale_threshold_seconds: number
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  fresh_threshold_seconds: 120,
  recent_threshold_seconds: 300,
  stale_threshold_seconds: 600,
}
