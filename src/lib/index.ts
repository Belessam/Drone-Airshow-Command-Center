export { calculateDistance, calculateBearing, calculateDestinationPoint, interpolateAlongLeg } from './simulation'
export { simulationRunner, evaluateFreshness, formatElapsed, getFreshnessWarning } from './simulation'
export type { DroneSimState, EstimatedPosition, Waypoint, FreshnessLevel, FreshnessInfo, FreshnessConfig } from './simulation'
export { DEFAULT_FRESHNESS_CONFIG } from './simulation'
