/**
 * Simulation Runner — waypoint-based flight-tracker simulation.
 *
 * Each drone follows a predefined route of geographic waypoints.
 * The drone continuously moves between waypoints at its configured speed.
 * Latitude/longitude/heading all update continuously per tick.
 *
 * The site coordinates are used to define the route area, but the
 * movement is true geographic waypoint navigation — NOT site-relative orbit.
 */

import { calculateBearing, calculateDistance, calculateDestinationPoint, interpolateAlongLeg } from './engine'
import type { DroneSimState, EstimatedPosition, Waypoint } from './types'
import type { Drone } from '@/types'

type PositionUpdateCallback = (positions: Map<string, EstimatedPosition>) => void

/**
 * Define realistic flight routes for drones based on their assigned site.
 * Each route is a loop of geographic waypoints near that site.
 */
function getRouteForSite(siteId: string): Waypoint[] {
  // These routes create visible rectangular patrol patterns around each site
  const routes: Record<string, Waypoint[]> = {
    // SITE-01 — patrol route
    'a0000000-0000-0000-0000-000000000001': [
      { latitude: 30.0500, longitude: 31.2400 },
      { latitude: 30.0800, longitude: 31.2800 },
      { latitude: 30.0700, longitude: 31.3200 },
      { latitude: 30.0400, longitude: 31.3000 },
      { latitude: 30.0200, longitude: 31.2600 },
    ],
    // SITE-02 — patrol route
    'a0000000-0000-0000-0000-000000000002': [
      { latitude: 24.7200, longitude: 46.6800 },
      { latitude: 24.7600, longitude: 46.7200 },
      { latitude: 24.7400, longitude: 46.7600 },
      { latitude: 24.7000, longitude: 46.7300 },
      { latitude: 24.6900, longitude: 46.6900 },
    ],
    // SITE-03 — coastal patrol
    'a0000000-0000-0000-0000-000000000003': [
      { latitude: 25.2048, longitude: 55.2708 },
      { latitude: 25.2300, longitude: 55.3000 },
      { latitude: 25.2500, longitude: 55.2700 },
      { latitude: 25.2200, longitude: 55.2400 },
      { latitude: 25.1900, longitude: 55.2500 },
    ],
    // SITE-04 — port patrol
    'a0000000-0000-0000-0000-000000000004': [
      { latitude: 25.2867, longitude: 55.2967 },
      { latitude: 25.3000, longitude: 55.3200 },
      { latitude: 25.3100, longitude: 55.2900 },
      { latitude: 25.2900, longitude: 55.2700 },
      { latitude: 25.2700, longitude: 55.2800 },
    ],
    // SITE-05 — coastal sweep
    'a0000000-0000-0000-0000-000000000005': [
      { latitude: 24.4700, longitude: 54.3800 },
      { latitude: 24.4900, longitude: 54.4100 },
      { latitude: 24.4800, longitude: 54.4400 },
      { latitude: 24.4600, longitude: 54.4200 },
      { latitude: 24.4500, longitude: 54.3900 },
    ],
  }
  return routes[siteId] || [
    // Default route if site not found
    { latitude: 30.0, longitude: 31.0 },
    { latitude: 30.1, longitude: 31.2 },
    { latitude: 30.0, longitude: 31.4 },
    { latitude: 29.9, longitude: 31.2 },
  ]
}

/**
 * Find the closest waypoint in a route to a given position, used for
 * initializing the drone at the correct route segment.
 */
function findClosestRouteIndex(
  route: Waypoint[],
  lat: number,
  lng: number,
): number {
  let minDist = Infinity
  let minIdx = 0
  for (let i = 0; i < route.length; i++) {
    const d = calculateDistance(lat, lng, route[i].latitude, route[i].longitude)
    if (d < minDist) {
      minDist = d
      minIdx = i
    }
  }
  return minIdx
}

/**
 * SimulationRunner manages the tick loop and per-drone waypoint navigation.
 */
class SimulationRunner {
  private drones = new Map<string, DroneSimState>()
  private latestPositions = new Map<string, EstimatedPosition>()
  /** Trail history per drone — stores last N positions as [lng, lat] for GeoJSON */
  private trails = new Map<string, number[][]>()
  private tickIntervalId: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<PositionUpdateCallback>()
  private tickMs: number

  constructor(tickMs = 250) {
    this.tickMs = tickMs
  }

  // ================================================================
  // DRONE MANAGEMENT
  // ================================================================

  upsertDrone(drone: Drone, headingFrom?: number, headingTo?: number, flightRelation?: 'approaching' | 'away'): void {
    if (!drone.is_active) {
      this.removeDrone(drone.id)
      return
    }

    // Determine heading range — use provided values or derive from drone heading
    const existing = this.drones.get(drone.id)
    const hdgFrom = headingFrom ?? existing?.headingFrom ?? drone.heading
    const hdgTo = headingTo ?? existing?.headingTo ?? drone.heading
    const relation = flightRelation ?? existing?.flightRelation ?? 'away'

    // Define route for this drone based on its site
    const route = getRouteForSite(drone.source_site_id)

    // Find which waypoint to head toward based on current position
    const startIdx = findClosestRouteIndex(route, drone.last_confirmed_latitude, drone.last_confirmed_longitude)
    const targetIdx = (startIdx + 1) % route.length
    const target = route[targetIdx]

    const legBearing = calculateBearing(
      drone.last_confirmed_latitude, drone.last_confirmed_longitude,
      target.latitude, target.longitude,
    )
    const legDistance = calculateDistance(
      drone.last_confirmed_latitude, drone.last_confirmed_longitude,
      target.latitude, target.longitude,
    )

    this.drones.set(drone.id, {
      droneId: drone.id,
      sourceSiteId: drone.source_site_id,
      latitude: drone.last_confirmed_latitude,
      longitude: drone.last_confirmed_longitude,
      heading: hdgFrom,
      speedMps: drone.speed_mps,
      altitude: drone.last_confirmed_altitude,
      headingFrom: hdgFrom,
      headingTo: hdgTo,
      headingProgress: 0,
      flightRelation: relation,
      route,
      targetWaypointIndex: targetIdx,
      legProgress: 0,
      legStartLatitude: drone.last_confirmed_latitude,
      legStartLongitude: drone.last_confirmed_longitude,
      currentLegDistanceM: legDistance,
      currentLegBearing: legBearing,
      lastConfirmedAt: new Date(drone.last_confirmed_at).getTime(),
      status: drone.simulation_status,
    })
  }

  removeDrone(droneId: string): void {
    this.drones.delete(droneId)
    this.latestPositions.delete(droneId)
    this.trails.delete(droneId)
  }

  setDrones(drones: Drone[]): void {
    const newIds = new Set(drones.map((d) => d.id))
    for (const [id] of this.drones) {
      if (!newIds.has(id)) this.removeDrone(id)
    }
    for (const drone of drones) {
      if (!this.drones.has(drone.id)) {
        this.upsertDrone(drone)
      }
    }
  }

  getTrail(droneId: string): number[][] {
    return this.trails.get(droneId) || []
  }

  getAllTrails(): Map<string, number[][]> {
    return new Map(this.trails)
  }

  clear(): void {
    this.drones.clear()
    this.latestPositions.clear()
    this.trails.clear()
  }

  // ================================================================
  // COMPUTATION
  // ================================================================

  /**
   * Advance a single drone along its route by elapsed time delta.
   * Heading sweeps from headingFrom toward headingTo over the full route cycle.
   */
  private advanceDrone(state: DroneSimState, deltaSeconds: number): EstimatedPosition {
    if (state.status !== 'simulating' || state.speedMps <= 0) {
      return {
        droneId: state.droneId,
        latitude: state.latitude,
        longitude: state.longitude,
        altitude: state.altitude,
        heading: state.heading,
        sourceSiteId: state.sourceSiteId,
        distanceTraveledM: 0,
        elapsedMs: 0,
        elapsedSeconds: 0,
        lastConfirmedAt: state.lastConfirmedAt,
        simulationStatus: state.status,
      }
    }

    // Advance heading progress (from → to) based on distance traveled
    // Full sweep over ~2 minutes of travel at typical speeds
    const headingSweepRate = 1 / (120 / deltaSeconds)
    state.headingProgress = Math.min(1, state.headingProgress + headingSweepRate)

    // Interpolate current heading from headingFrom toward headingTo
    // For 'approaching', shift the range by 180° so the drone faces the site
    const isApproaching = state.flightRelation === 'approaching'
    let fromH = isApproaching ? (state.headingFrom + 180) % 360 : state.headingFrom
    let toH = isApproaching ? (state.headingTo + 180) % 360 : state.headingTo
    // Normalize to shortest path
    let diff = ((toH - fromH) % 360 + 360) % 360
    if (diff > 180) diff -= 360
    const currentHeading = ((fromH + diff * state.headingProgress) % 360 + 360) % 360

    // Move the drone using its current heading
    const distanceThisTick = state.speedMps * deltaSeconds
    const newPos = calculateDestinationPoint(
      state.latitude,
      state.longitude,
      currentHeading,
      distanceThisTick,
    )

    state.latitude = newPos.latitude
    state.longitude = newPos.longitude
    state.heading = currentHeading

    // Continue advancing along the route for waypoint transitions
    const route = state.route
    const targetIdx = state.targetWaypointIndex
    let newProgress = state.legProgress + (distanceThisTick / state.currentLegDistanceM)

    while (newProgress >= 1.0 && route.length >= 2) {
      const nextTargetIdx = (targetIdx + 1) % route.length
      const from = route[targetIdx]
      const to = route[nextTargetIdx]

      const remainingProgress = newProgress - 1.0
      const newLegDistance = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude)
      const newLegBearing = calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude)

      state.targetWaypointIndex = nextTargetIdx
      state.currentLegDistanceM = newLegDistance
      state.currentLegBearing = newLegBearing
      state.legProgress = 0
      state.legStartLatitude = from.latitude
      state.legStartLongitude = from.longitude

      if (remainingProgress > 0 && newLegDistance > 0) {
        newProgress = remainingProgress * (state.currentLegDistanceM / newLegDistance)
      } else {
        newProgress = 0
        break
      }
    }

    state.legProgress = Math.max(0, Math.min(1, newProgress))

    return {
      droneId: state.droneId,
      latitude: state.latitude,
      longitude: state.longitude,
      altitude: state.altitude,
      heading: currentHeading,
      sourceSiteId: state.sourceSiteId,
      distanceTraveledM: state.speedMps * (Date.now() - state.lastConfirmedAt) / 1000,
      elapsedMs: Date.now() - state.lastConfirmedAt,
      elapsedSeconds: (Date.now() - state.lastConfirmedAt) / 1000,
      lastConfirmedAt: state.lastConfirmedAt,
      simulationStatus: state.status,
    }
  }

  private tick(): void {
    const now = Date.now()
    for (const [id, state] of this.drones) {
      const pos = this.advanceDrone(state, this.tickMs / 1000)
      this.latestPositions.set(id, pos)

      // Accumulate trail (sample every 2 ticks to avoid excessive points)
      if (!this.trails.has(id)) this.trails.set(id, [])
      const trail = this.trails.get(id)!
      if (trail.length === 0 || (trail[trail.length - 1][0] !== pos.longitude && trail[trail.length - 1][1] !== pos.latitude)) {
        trail.push([pos.longitude, pos.latitude])
        // Keep trail to last 100 points
        if (trail.length > 100) trail.shift()
      }
    }
    this.notifyListeners()
  }

  // ================================================================
  // LIFECYCLE
  // ================================================================

  start(): void {
    if (this.tickIntervalId) return
    this.tick()
    this.tickIntervalId = setInterval(() => this.tick(), this.tickMs)
  }

  stop(): void {
    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId)
      this.tickIntervalId = null
    }
  }

  getPosition(droneId: string): EstimatedPosition | undefined {
    return this.latestPositions.get(droneId)
  }

  getAllPositions(): Map<string, EstimatedPosition> {
    return new Map(this.latestPositions)
  }

  getAllPositionsArray(): EstimatedPosition[] {
    return Array.from(this.latestPositions.values())
  }

  get isRunning(): boolean {
    return this.tickIntervalId !== null
  }

  get droneCount(): number {
    return this.drones.size
  }

  // ================================================================
  // LISTENERS
  // ================================================================

  onUpdate(callback: PositionUpdateCallback): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners(): void {
    if (this.listeners.size === 0) return
    const positions = this.getAllPositions()
    for (const listener of this.listeners) {
      listener(positions)
    }
  }
}

export const simulationRunner = new SimulationRunner(250)
