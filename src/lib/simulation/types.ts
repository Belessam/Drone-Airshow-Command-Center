import type { SimulationStatus } from '@/types'

/**
 * A geographic waypoint for drone route navigation.
 */
export interface Waypoint {
  latitude: number
  longitude: number
}

/**
 * Full state needed to run a waypoint-based flight simulation.
 *
 * The drone moves between geographic waypoints along a predefined route.
 * Position is interpolated continuously based on speed and elapsed time.
 */
export interface DroneSimState {
  droneId: string
  sourceSiteId: string

  /** Current geographic position */
  latitude: number
  longitude: number

  /** Current heading (direction of travel, degrees 0-360) */
  heading: number

  /** Speed in meters per second */
  speedMps: number

  /** Altitude in meters (informational) */
  altitude: number

  /** Heading range — start heading (deployment bearing), sweeps toward end heading */
  headingFrom: number
  headingTo: number
  /** Current interpolation progress from headingFrom → headingTo (0.0 to 1.0) */
  headingProgress: number
  /** Flight direction relative to site: 'away' or 'approaching' */
  flightRelation: 'away' | 'approaching'

  /** Route waypoints — the drone loops through these */
  route: Waypoint[]

  /** Index of the waypoint we are currently flying TOWARD */
  targetWaypointIndex: number

  /** Fraction of the current leg completed (0.0 to 1.0) */
  legProgress: number

  /** Geographic position at the start of this leg (for stable interpolation) */
  legStartLatitude: number
  legStartLongitude: number

  /** Total distance of the current leg in meters */
  currentLegDistanceM: number

  /** Bearing of the current leg */
  currentLegBearing: number

  /** Timestamp of last confirmed update (unix ms) */
  lastConfirmedAt: number

  /** Simulation status */
  status: SimulationStatus
}

/**
 * Live computed position from the waypoint-based simulation engine.
 */
export interface EstimatedPosition {
  droneId: string
  latitude: number
  longitude: number
  altitude: number
  heading: number
  sourceSiteId: string
  distanceTraveledM: number
  elapsedMs: number
  elapsedSeconds: number
  lastConfirmedAt: number
  simulationStatus: SimulationStatus
}

/**
 * Data freshness level.
 */
export type FreshnessLevel = 'fresh' | 'recent' | 'stale' | 'critical'

export interface FreshnessInfo {
  level: FreshnessLevel
  label: string
  color: string
  elapsedSeconds: number
  positionConfidence: 'high' | 'medium' | 'low' | 'minimal'
}

export interface FreshnessConfig {
  freshThreshold: number
  recentThreshold: number
  staleThreshold: number
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  freshThreshold: 120,
  recentThreshold: 300,
  staleThreshold: 600,
}
