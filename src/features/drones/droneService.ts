/**
 * Drone Service — orchestrates drone creation and update operations.
 *
 * Each operation that modifies drone data also creates:
 * - A drone_update record (append-only history)
 * - A drone_event record (timeline entry)
 * - Proper simulation segment archival (Phase 8)
 *
 * This keeps the orchestration logic separate from UI components.
 */

import { supabase } from '@/lib/supabase/client'
import { calculateArchiveEndPosition } from '@/lib/simulation/archive'
import { isDemoMode } from '@/utils/demoMode'
import { mockSites } from '@/utils/mockData'
import type { Drone, DroneUpdate, DroneEvent, DroneSimulationSegment, Site } from '@/types'

// ================================================================
// CREATION
// ================================================================

export interface CreateDroneParams {
  drone_id: string
  source_site_id: string
  latitude: number
  longitude: number
  altitude: number
  heading: number
  speed_mps: number
  user_id?: string | null
  /** Optional heading range for dynamic flight simulation */
  headingFrom?: number
  headingTo?: number
  flight_relation?: 'approaching' | 'away'
}

export interface CreateDroneResult {
  drone: Drone
  update: DroneUpdate
  event: DroneEvent
  segment: DroneSimulationSegment | null
}

/**
 * Create a new drone with all associated records.
 * Creates the initial active simulation segment.
 */
export async function createDroneWithHistory(
  params: CreateDroneParams,
): Promise<CreateDroneResult> {
  if (isDemoMode()) {
    return createDroneDemo(params)
  }

  const now = new Date().toISOString()
  const droneId = crypto.randomUUID()

  // 1. Insert the drone
  const { data: drone, error: droneErr } = await supabase
    .from('drones')
    .insert({
      id: droneId,
      drone_id: params.drone_id,
      source_site_id: params.source_site_id,
      last_confirmed_latitude: params.latitude,
      last_confirmed_longitude: params.longitude,
      last_confirmed_altitude: params.altitude,
      heading: params.heading,
      speed_mps: params.speed_mps,
      simulation_status: 'simulating',
      simulation_started_at: now,
      is_active: true,
    })
    .select()
    .single()

  if (droneErr) throw new Error(`Failed to create drone: ${droneErr.message}`)

  // 2. Insert the initial update record
  const { data: update, error: updErr } = await supabase
    .from('drone_updates')
    .insert({
      drone_id: drone.id,
      site_id: params.source_site_id,
      user_id: params.user_id ?? null,
      latitude: params.latitude,
      longitude: params.longitude,
      altitude: params.altitude,
      heading: params.heading,
      speed_mps: params.speed_mps,
      notes: 'Initial drone registration.',
    })
    .select()
    .single()

  if (updErr) throw new Error(`Failed to create update: ${updErr.message}`)

  // 3. Insert the creation event
  const { data: event, error: evtErr } = await supabase
    .from('drone_events')
    .insert({
      drone_id: drone.id,
      event_type: 'drone_created',
      site_id: params.source_site_id,
      user_id: params.user_id ?? null,
      data: {
        heading: params.heading,
        speed: params.speed_mps,
        altitude: params.altitude,
        latitude: params.latitude,
        longitude: params.longitude,
      },
    })
    .select()
    .single()

  if (evtErr) throw new Error(`Failed to create event: ${evtErr.message}`)

  // 4. Insert simulation started event
  await supabase.from('drone_events').insert({
    drone_id: drone.id,
    event_type: 'simulation_started',
    site_id: params.source_site_id,
    user_id: params.user_id ?? null,
    data: { heading: params.heading, speed: params.speed_mps, altitude: params.altitude },
  })

  // 5. Create initial simulation segment (active — ended_at is null)
  const { data: segment, error: segErr } = await supabase
    .from('drone_simulation_segments')
    .insert({
      drone_id: drone.id,
      started_at: now,
      start_latitude: params.latitude,
      start_longitude: params.longitude,
      heading: params.heading,
      speed_mps: params.speed_mps,
      altitude: params.altitude,
      started_by_update_id: update.id,
    })
    .select()
    .single()

  if (segErr) throw new Error(`Failed to create segment: ${segErr.message}`)

  return {
    drone: drone as Drone,
    update: update as DroneUpdate,
    event: event as DroneEvent,
    segment: segment as DroneSimulationSegment,
  }
}

// ================================================================
// UPDATE
// ================================================================

export interface UpdateDroneParams {
  drone_id: string
  site_id: string
  latitude: number
  longitude: number
  altitude: number
  heading: number
  speed_mps: number
  notes?: string | null
  user_id?: string | null
}

export interface UpdateDroneResult {
  drone: Drone
  update: DroneUpdate
  event: DroneEvent
  archivedSegment: DroneSimulationSegment | null
  newSegment: DroneSimulationSegment | null
}

/**
 * Update an existing drone's confirmed state with correct simulation archival.
 *
 * CRITICAL SEQUENCE:
 * 1. Read the active simulation segment
 * 2. Calculate the final estimated position at the update timestamp
 * 3. End the active segment with the estimated position
 * 4. Create the drone update record
 * 5. Update the drone confirmed state
 * 6. Create the update event
 * 7. Create a new active simulation segment
 */
export async function updateDroneWithHistory(
  params: UpdateDroneParams,
): Promise<UpdateDroneResult> {
  if (isDemoMode()) {
    return updateDroneDemo(params)
  }

  const now = new Date().toISOString()

  // 1. Read the active simulation segment
  const { data: activeSegments, error: segQueryErr } = await supabase
    .from('drone_simulation_segments')
    .select('*')
    .eq('drone_id', params.drone_id)
    .is('ended_at', null)
    .limit(1)

  if (segQueryErr) throw new Error(`Failed to query active segment: ${segQueryErr.message}`)

  const activeSegment = activeSegments && activeSegments.length > 0
    ? activeSegments[0] as DroneSimulationSegment
    : null

  // 2. Use the new confirmed position as the archive end position
  let endLat = params.latitude
  let endLng = params.longitude
  let archivedSegment: DroneSimulationSegment | null = null

  if (activeSegment) {
    // In site-relative model, the archive position is the drone's computed
    // geographic position at the update time, which becomes the new confirmed state.
    // We pass the incoming params lat/lng as the archive end.
    const archiveResult = calculateArchiveEndPosition({
      activeSegment,
      updateTimestamp: now,
      endLatitude: params.latitude,
      endLongitude: params.longitude,
    })
    endLat = archiveResult.endLatitude
    endLng = archiveResult.endLongitude
  }

  // 3. Create the drone update record (needed for foreign keys)
  const { data: update, error: updErr } = await supabase
    .from('drone_updates')
    .insert({
      drone_id: params.drone_id,
      site_id: params.site_id,
      user_id: params.user_id ?? null,
      latitude: params.latitude,
      longitude: params.longitude,
      altitude: params.altitude,
      heading: params.heading,
      speed_mps: params.speed_mps,
      notes: params.notes ?? null,
    })
    .select()
    .single()

  if (updErr) throw new Error(`Failed to create update: ${updErr.message}`)

  // 4. End the active simulation segment with the CALCULATED estimated position
  if (activeSegment) {
    const { data: endedSeg, error: endSegErr } = await supabase
      .from('drone_simulation_segments')
      .update({
        ended_at: now,
        end_latitude: endLat,
        end_longitude: endLng,
        ended_by_update_id: update.id,
      })
      .eq('id', activeSegment.id)
      .select()
      .single()

    if (endSegErr) throw new Error(`Failed to end segment: ${endSegErr.message}`)
    archivedSegment = endedSeg as DroneSimulationSegment

    // Insert simulation_ended event
    await supabase.from('drone_events').insert({
      drone_id: params.drone_id,
      event_type: 'simulation_ended',
      site_id: params.site_id,
      user_id: params.user_id ?? null,
      data: {
        ended_at: now,
        end_latitude: endLat,
        end_longitude: endLng,
        heading: activeSegment.heading,
        speed: activeSegment.speed_mps,
        duration_seconds: (new Date(now).getTime() - new Date(activeSegment.started_at).getTime()) / 1000,
      },
    })
  }

  // 5. Update the drone's confirmed state
  const { data: drone, error: droneErr } = await supabase
    .from('drones')
    .update({
      last_confirmed_latitude: params.latitude,
      last_confirmed_longitude: params.longitude,
      last_confirmed_altitude: params.altitude,
      heading: params.heading,
      speed_mps: params.speed_mps,
      last_confirmed_at: now,
      simulation_started_at: now,
      simulation_status: 'simulating',
    })
    .eq('id', params.drone_id)
    .select()
    .single()

  if (droneErr) throw new Error(`Failed to update drone: ${droneErr.message}`)

  // 6. Insert update event
  const { data: event, error: evtErr } = await supabase
    .from('drone_events')
    .insert({
      drone_id: params.drone_id,
      event_type: 'drone_updated',
      site_id: params.site_id,
      user_id: params.user_id ?? null,
      data: {
        heading: params.heading,
        speed: params.speed_mps,
        altitude: params.altitude,
        latitude: params.latitude,
        longitude: params.longitude,
        notes: params.notes ?? null,
        previous_segment_ended: activeSegment ? true : false,
        previous_end_latitude: endLat,
        previous_end_longitude: endLng,
      },
    })
    .select()
    .single()

  if (evtErr) throw new Error(`Failed to create event: ${evtErr.message}`)

  // 7. Insert simulation started event
  await supabase.from('drone_events').insert({
    drone_id: params.drone_id,
    event_type: 'simulation_started',
    site_id: params.site_id,
    user_id: params.user_id ?? null,
    data: {
      heading: params.heading,
      speed: params.speed_mps,
      altitude: params.altitude,
    },
  })

  // 8. Create new active simulation segment
  const { data: newSegment, error: newSegErr } = await supabase
    .from('drone_simulation_segments')
    .insert({
      drone_id: params.drone_id,
      started_at: now,
      start_latitude: params.latitude,
      start_longitude: params.longitude,
      heading: params.heading,
      speed_mps: params.speed_mps,
      altitude: params.altitude,
      started_by_update_id: update.id,
    })
    .select()
    .single()

  if (newSegErr) throw new Error(`Failed to create new segment: ${newSegErr.message}`)

  return {
    drone: drone as Drone,
    update: update as DroneUpdate,
    event: event as DroneEvent,
    archivedSegment,
    newSegment: newSegment as DroneSimulationSegment,
  }
}

// ================================================================
// DEMO MODE
// ================================================================

let demoIdCounter = 10
const demoSites: Site[] = mockSites
const droneMap = new Map<string, Drone>()
const demoSegmentMap = new Map<string, any[]>()

function addDemoSeg(droneId: string, seg: any) {
  const existing = demoSegmentMap.get(droneId) || []
  existing.push(seg)
  demoSegmentMap.set(droneId, existing)
}

export function getDemoDroneById(id: string): Drone | undefined {
  return droneMap.get(id)
}

/** Get ALL demo drones — including dynamically registered ones */
export function getAllDemoDrones(): Drone[] {
  return Array.from(droneMap.values())
}

export function getDemoSegmentsForDrone(droneId: string): any[] {
  return demoSegmentMap.get(droneId) || []
}

function createDroneDemo(params: CreateDroneParams): CreateDroneResult {
  demoIdCounter++
  const now = new Date().toISOString()
  const droneId = `d-${String(demoIdCounter).padStart(3, '0')}`

  const drone: Drone = {
    id: droneId,
    drone_id: params.drone_id,
    source_site_id: params.source_site_id,
    last_confirmed_latitude: params.latitude,
    last_confirmed_longitude: params.longitude,
    last_confirmed_altitude: params.altitude,
    heading: params.heading,
    speed_mps: params.speed_mps,
    last_confirmed_at: now,
    simulation_started_at: now,
    simulation_status: 'simulating',
    is_active: true,
    created_at: now,
    updated_at: now,
  }
  droneMap.set(drone.id, drone)

  const update: DroneUpdate = {
    id: `upd-demo-${demoIdCounter}`,
    drone_id: drone.id,
    site_id: params.source_site_id,
    user_id: params.user_id ?? null,
    latitude: params.latitude,
    longitude: params.longitude,
    altitude: params.altitude,
    heading: params.heading,
    speed_mps: params.speed_mps,
    notes: 'Initial drone registration.',
    created_at: now,
  }

  const event: DroneEvent = {
    id: `evt-demo-${demoIdCounter}`,
    drone_id: drone.id,
    event_type: 'drone_created',
    site_id: params.source_site_id,
    user_id: params.user_id ?? null,
    data: { heading: params.heading, speed: params.speed_mps, altitude: params.altitude },
    created_at: now,
  }

  // Create initial active segment
  const segment = {
    id: `seg-demo-${demoIdCounter}`,
    drone_id: drone.id,
    started_at: now,
    ended_at: null as string | null,
    start_latitude: params.latitude,
    start_longitude: params.longitude,
    end_latitude: null as number | null,
    end_longitude: null as number | null,
    heading: params.heading,
    speed_mps: params.speed_mps,
    altitude: params.altitude,
    started_by_update_id: update.id,
    ended_by_update_id: null as string | null,
    created_at: now,
  }
  addDemoSeg(drone.id, segment)

  return { drone, update, event, segment }
}

function updateDroneDemo(params: UpdateDroneParams): UpdateDroneResult {
  const now = new Date().toISOString()
  const existing = droneMap.get(params.drone_id)

  // Calculate archive end position
  const segments = demoSegmentMap.get(params.drone_id) || []
  const activeSegment = segments.find((s: any) => s.ended_at === null)

  let endLat = params.latitude
  let endLng = params.longitude
  let archivedSegment = null

  if (activeSegment) {
    const archiveResult = calculateArchiveEndPosition({
      activeSegment: activeSegment as any,
      updateTimestamp: now,
      endLatitude: params.latitude,
      endLongitude: params.longitude,
    })
    endLat = archiveResult.endLatitude
    endLng = archiveResult.endLongitude
  }

  const drone: Drone = {
    ...(existing || {
      id: params.drone_id,
      drone_id: params.drone_id,
      source_site_id: params.site_id,
      last_confirmed_latitude: params.latitude,
      last_confirmed_longitude: params.longitude,
      last_confirmed_altitude: params.altitude,
      heading: params.heading,
      speed_mps: params.speed_mps,
      last_confirmed_at: now,
      simulation_started_at: now,
      simulation_status: 'simulating',
      is_active: true,
      created_at: now,
      updated_at: now,
    }),
    last_confirmed_latitude: params.latitude,
    last_confirmed_longitude: params.longitude,
    last_confirmed_altitude: params.altitude,
    heading: params.heading,
    speed_mps: params.speed_mps,
    last_confirmed_at: now,
    simulation_started_at: now,
    simulation_status: 'simulating',
    updated_at: now,
  }
  droneMap.set(drone.id, drone)

  const update: DroneUpdate = {
    id: `upd-demo-${Date.now()}`,
    drone_id: params.drone_id,
    site_id: params.site_id,
    user_id: params.user_id ?? null,
    latitude: params.latitude,
    longitude: params.longitude,
    altitude: params.altitude,
    heading: params.heading,
    speed_mps: params.speed_mps,
    notes: params.notes ?? null,
    created_at: now,
  }

  const event: DroneEvent = {
    id: `evt-demo-${Date.now()}`,
    drone_id: params.drone_id,
    event_type: 'drone_updated',
    site_id: params.site_id,
    user_id: params.user_id ?? null,
    data: {
      heading: params.heading,
      speed: params.speed_mps,
      altitude: params.altitude,
      notes: params.notes ?? null,
      previous_segment_ended: activeSegment ? true : false,
      previous_end_latitude: endLat,
      previous_end_longitude: endLng,
    },
    created_at: now,
  }

  // End the active segment
  if (activeSegment) {
    activeSegment.ended_at = now
    activeSegment.end_latitude = endLat
    activeSegment.end_longitude = endLng
    activeSegment.ended_by_update_id = update.id
    archivedSegment = { ...activeSegment }
  }

  // Create new active segment
  const newSegment = {
    id: `seg-demo-${Date.now()}`,
    drone_id: params.drone_id,
    started_at: now,
    ended_at: null as string | null,
    start_latitude: params.latitude,
    start_longitude: params.longitude,
    end_latitude: null as number | null,
    end_longitude: null as number | null,
    heading: params.heading,
    speed_mps: params.speed_mps,
    altitude: params.altitude,
    started_by_update_id: update.id,
    ended_by_update_id: null as string | null,
    created_at: now,
  }
  addDemoSeg(drone.id, newSegment)

  return { drone, update, event, archivedSegment, newSegment }
}
