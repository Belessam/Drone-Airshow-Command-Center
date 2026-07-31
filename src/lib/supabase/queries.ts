/**
 * Supabase query helpers.
 * These functions encapsulate all Supabase queries for the application.
 * They are separated from UI components to keep data access clean.
 */

import { supabase } from './client'
import type {
  Site,
  Drone,
  DroneUpdate,
  DroneSimulationSegment,
  DroneEvent,
  Alert,
  Profile,
} from '@/types'

// ================================================================
// SITES
// ================================================================

export async function fetchSites(): Promise<Site[]> {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('code', { ascending: true })

  if (error) throw error
  return data as Site[]
}

export async function fetchSiteById(id: string): Promise<Site | null> {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Site
}

export async function createSite(site: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> {
  const { data, error } = await supabase
    .from('sites')
    .insert(site)
    .select()
    .single()

  if (error) throw error
  return data as Site
}

export async function updateSite(id: string, updates: Partial<Site>): Promise<Site> {
  const { data, error } = await supabase
    .from('sites')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Site
}

export async function deleteSite(id: string): Promise<void> {
  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ================================================================
// DRONES
// ================================================================

export async function fetchDrones(): Promise<Drone[]> {
  const { data, error } = await supabase
    .from('drones')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Drone[]
}

export async function fetchDronesWithSites(): Promise<any[]> {
  const { data, error } = await supabase
    .from('drones')
    .select('*, source_site:sites(*)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchActiveDrones(): Promise<Drone[]> {
  const { data, error } = await supabase
    .from('drones')
    .select('*')
    .eq('is_active', true)
    .order('drone_id', { ascending: true })

  if (error) throw error
  return data as Drone[]
}

export async function fetchDroneById(id: string): Promise<Drone | null> {
  const { data, error } = await supabase
    .from('drones')
    .select('*, source_site:sites(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as any
}

export async function fetchDroneByDroneId(droneId: string): Promise<Drone | null> {
  const { data, error } = await supabase
    .from('drones')
    .select('*, source_site:sites(*)')
    .eq('drone_id', droneId)
    .single()

  if (error) throw error
  return data as any
}

export interface CreateDroneInput {
  drone_id: string
  source_site_id: string
  last_confirmed_latitude: number
  last_confirmed_longitude: number
  last_confirmed_altitude: number
  heading: number
  speed_mps: number
}

export async function createDrone(input: CreateDroneInput): Promise<Drone> {
  // Start a simulation segment immediately
  const { data, error } = await supabase
    .from('drones')
    .insert({
      drone_id: input.drone_id,
      source_site_id: input.source_site_id,
      last_confirmed_latitude: input.last_confirmed_latitude,
      last_confirmed_longitude: input.last_confirmed_longitude,
      last_confirmed_altitude: input.last_confirmed_altitude,
      heading: input.heading,
      speed_mps: input.speed_mps,
      simulation_status: 'simulating',
      simulation_started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as Drone
}

export interface UpdateDroneInput {
  latitude: number
  longitude: number
  altitude: number
  heading: number
  speed_mps: number
  notes?: string
}

export async function updateDrone(
  droneId: string,
  siteId: string,
  input: UpdateDroneInput,
): Promise<Drone> {
  const { data, error } = await supabase
    .from('drones')
    .update({
      last_confirmed_latitude: input.latitude,
      last_confirmed_longitude: input.longitude,
      last_confirmed_altitude: input.altitude,
      heading: input.heading,
      speed_mps: input.speed_mps,
      last_confirmed_at: new Date().toISOString(),
      simulation_started_at: new Date().toISOString(),
      simulation_status: 'simulating',
    })
    .eq('id', droneId)
    // Add site_id filter so RLS has the correct context and non-admin users
    // can only update drones that belong to their own site
    .eq('source_site_id', siteId)
    .select()
    .single()

  if (error) throw error
  return data as Drone
}

// ================================================================
// DRONE UPDATES
// ================================================================

export async function fetchUpdatesForDrone(droneId: string): Promise<DroneUpdate[]> {
  const { data, error } = await supabase
    .from('drone_updates')
    .select('*')
    .eq('drone_id', droneId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as DroneUpdate[]
}

export async function createDroneUpdate(input: {
  drone_id: string
  site_id: string
  user_id?: string | null
  latitude: number
  longitude: number
  altitude: number
  heading: number
  speed_mps: number
  notes?: string | null
}): Promise<DroneUpdate> {
  const { data, error } = await supabase
    .from('drone_updates')
    .insert({
      drone_id: input.drone_id,
      site_id: input.site_id,
      user_id: input.user_id ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      altitude: input.altitude,
      heading: input.heading,
      speed_mps: input.speed_mps,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as DroneUpdate
}

// ================================================================
// SIMULATION SEGMENTS
// ================================================================

export async function fetchSegmentsForDrone(droneId: string): Promise<DroneSimulationSegment[]> {
  const { data, error } = await supabase
    .from('drone_simulation_segments')
    .select('*')
    .eq('drone_id', droneId)
    .order('started_at', { ascending: true })

  if (error) throw error
  return data as DroneSimulationSegment[]
}

export async function fetchActiveSegmentForDrone(droneId: string): Promise<DroneSimulationSegment | null> {
  const { data, error } = await supabase
    .from('drone_simulation_segments')
    .select('*')
    .eq('drone_id', droneId)
    .is('ended_at', null)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
  return data as DroneSimulationSegment | null
}

export async function createSimulationSegment(input: {
  drone_id: string
  started_at: string
  start_latitude: number
  start_longitude: number
  heading: number
  speed_mps: number
  altitude: number
  started_by_update_id?: string | null
}): Promise<DroneSimulationSegment> {
  const { data, error } = await supabase
    .from('drone_simulation_segments')
    .insert({
      drone_id: input.drone_id,
      started_at: input.started_at,
      start_latitude: input.start_latitude,
      start_longitude: input.start_longitude,
      heading: input.heading,
      speed_mps: input.speed_mps,
      altitude: input.altitude,
      started_by_update_id: input.started_by_update_id ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as DroneSimulationSegment
}

export async function endSimulationSegment(
  segmentId: string,
  endLatitude: number,
  endLongitude: number,
  endedByUpdateId: string | null,
  endedAt: string,
): Promise<DroneSimulationSegment> {
  const { data, error } = await supabase
    .from('drone_simulation_segments')
    .update({
      ended_at: endedAt,
      end_latitude: endLatitude,
      end_longitude: endLongitude,
      ended_by_update_id: endedByUpdateId,
    })
    .eq('id', segmentId)
    .select()
    .single()

  if (error) throw error
  return data as DroneSimulationSegment
}

// ================================================================
// EVENTS
// ================================================================

export async function fetchEventsForDrone(droneId: string): Promise<DroneEvent[]> {
  const { data, error } = await supabase
    .from('drone_events')
    .select('*, site:sites(*), profiles(full_name)')
    .eq('drone_id', droneId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any
}

export async function fetchAllEvents(limit = 50): Promise<DroneEvent[]> {
  const { data, error } = await supabase
    .from('drone_events')
    .select('*, site:sites(*), profiles(full_name), drone:drones(drone_id)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as any
}

export async function createEvent(input: {
  drone_id: string
  event_type: DroneEvent['event_type']
  site_id?: string | null
  user_id?: string | null
  data?: Record<string, unknown>
}): Promise<DroneEvent> {
  const { data, error } = await supabase
    .from('drone_events')
    .insert({
      drone_id: input.drone_id,
      event_type: input.event_type,
      site_id: input.site_id ?? null,
      user_id: input.user_id ?? null,
      data: input.data ?? {},
    })
    .select()
    .single()

  if (error) throw error
  return data as DroneEvent
}

// ================================================================
// ALERTS
// ================================================================

export async function fetchAlerts(options?: {
  unresolved?: boolean
  severity?: string
  limit?: number
}): Promise<Alert[]> {
  let query = supabase
    .from('alerts')
    .select('*, drone:drones(drone_id)')

  if (options?.unresolved) {
    query = query.eq('is_resolved', false)
  }

  if (options?.severity) {
    query = query.eq('severity', options.severity)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (error) throw error
  return data as any
}

export async function createAlert(input: {
  drone_id?: string | null
  alert_type: Alert['alert_type']
  severity: Alert['severity']
  title: string
  message: string
  data?: Record<string, unknown> | null
}): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      drone_id: input.drone_id ?? null,
      alert_type: input.alert_type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      data: input.data ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Alert
}

export async function resolveAlert(id: string): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Alert
}

// ================================================================
// PROFILES
// ================================================================

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data as Profile
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data as Profile
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true })

  if (error) throw error
  return data as Profile[]
}

// ================================================================
// REALTIME SUBSCRIPTIONS
// ================================================================

export function subscribeToDrones(callback: (payload: any) => void) {
  return supabase
    .channel('drones-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'drones' },
      callback,
    )
    .subscribe()
}

export function subscribeToAlerts(callback: (payload: any) => void) {
  return supabase
    .channel('alerts-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'alerts' },
      callback,
    )
    .subscribe()
}

export function subscribeToEvents(callback: (payload: any) => void) {
  return supabase
    .channel('events-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'drone_events' },
      callback,
    )
    .subscribe()
}

// ================================================================
// DRONE DELETION
// ================================================================

export async function deleteDrone(id: string, siteId?: string): Promise<void> {
  let query = supabase
    .from('drones')
    .delete()
    .eq('id', id)

  // Non-admin users must also match source_site_id so they can only delete their own drones
  if (siteId) {
    query = query.eq('source_site_id', siteId)
  }

  const { error } = await query
  if (error) throw error
}
