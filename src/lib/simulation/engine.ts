/**
 * Simulation Engine — waypoint-based drone movement.
 *
 * The drone moves between geographic waypoints along a predefined route.
 * Uses proper geodesic calculations:
 *   - destinationPoint: where the drone will be after moving at a bearing for a distance
 *   - calculateBearing: direction from current position to next waypoint
 *   - calculateDistance: how far the drone is from the waypoint
 *
 * All calculations use haversine formula on real latitude/longitude.
 */

export interface SimInput {
  startLatitude: number
  startLongitude: number
  bearing: number     // degrees 0-360, 0 = North
  distanceMeters: number
  altitude: number
}

export interface SimOutput {
  latitude: number
  longitude: number
  altitude: number
}

const EARTH_RADIUS_M = 6_371_000

/**
 * Calculate destination coordinate from start point, bearing, and distance.
 * Uses the haversine formula.
 */
function destinationPoint(
  lat: number,
  lng: number,
  bearing: number,
  distance: number,
): { latitude: number; longitude: number } {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const bearingRad = (bearing * Math.PI) / 180
  const distRatio = distance / EARTH_RADIUS_M

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distRatio) +
      Math.cos(latRad) * Math.sin(distRatio) * Math.cos(bearingRad),
  )

  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distRatio) * Math.cos(latRad),
      Math.cos(distRatio) - Math.sin(latRad) * Math.sin(newLatRad),
    )

  return {
    latitude: (newLatRad * 180) / Math.PI,
    longitude: (newLngRad * 180) / Math.PI,
  }
}

/**
 * Calculate the distance between two geographic coordinates in meters.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const latRad1 = (lat1 * Math.PI) / 180
  const latRad2 = (lat2 * Math.PI) / 180
  const lngDiff = ((lng2 - lng1) * Math.PI) / 180
  const latDiff = latRad2 - latRad1

  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(latRad1) * Math.cos(latRad2) * Math.sin(lngDiff / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_M * c
}

/**
 * Calculate bearing between two geographic coordinates.
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const latRad1 = (lat1 * Math.PI) / 180
  const latRad2 = (lat2 * Math.PI) / 180
  const lngDiff = ((lng2 - lng1) * Math.PI) / 180

  const y = Math.sin(lngDiff) * Math.cos(latRad2)
  const x =
    Math.cos(latRad1) * Math.sin(latRad2) -
    Math.sin(latRad1) * Math.cos(latRad2) * Math.cos(lngDiff)

  const bearing = (Math.atan2(y, x) * 180) / Math.PI
  return (bearing + 360) % 360
}

/**
 * Calculate a geographic destination point from start + bearing + distance (in meters).
 */
export function calculateDestinationPoint(
  startLatitude: number,
  startLongitude: number,
  bearingDeg: number,
  distanceMeters: number,
): { latitude: number; longitude: number } {
  return destinationPoint(startLatitude, startLongitude, bearingDeg, distanceMeters)
}

/**
 * Compute the interpolated position along a leg between two waypoints.
 *
 * @param fromLat - Start latitude of the leg
 * @param fromLng - Start longitude of the leg
 * @param bearing - Bearing of the leg (from start to end)
 * @param legDistanceM - Total distance of the leg in meters
 * @param progress - Fraction of leg completed (0.0 to 1.0)
 * @returns Interpolated geographic position
 */
export function interpolateAlongLeg(
  fromLat: number,
  fromLng: number,
  bearing: number,
  legDistanceM: number,
  progress: number,
): { latitude: number; longitude: number } {
  const clamped = Math.max(0, Math.min(1, progress))
  const distanceM = legDistanceM * clamped
  return destinationPoint(fromLat, fromLng, bearing, distanceM)
}
