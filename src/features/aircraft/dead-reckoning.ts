/**
 * Dead-reckoning interpolation for live aircraft markers.
 *
 * Between API polls (every ~30s), aircraft continue moving.
 * Each call calculates position FROM the last confirmed API position,
 * NOT from any previously extrapolated position — avoiding compounding errors.
 *
 * Every animation tick recalculates the estimate from scratch:
 *   elapsed = now - lastPositionUpdate
 *   distance = speed_in_mps × elapsed_seconds
 *   newPos = destinationPoint(confirmedLat, confirmedLon, heading, distance)
 *
 * Unit verification:
 *   Provider speed:           knots (nautical miles per hour)
 *   1 knot                   = 0.514444 m/s
 *   speed_mps               = speed_knots × 0.514444
 *   elapsed_seconds          = (now_ms - lastUpdate_ms) / 1000
 *   distance_meters          = speed_mps × elapsed_seconds
 *   haversine destination    = distance in meters / Earth radius in meters
 *
 * Real-world verification:
 *   250 kt → 128.6 m/s → ~463 m traveled in 3.6s, ~7.7 km in 60s
 *   400 kt → 205.8 m/s → ~741 m in 3.6s, ~12.3 km in 60s
 *   500 kt → 257.2 m/s → ~926 m in 3.6s, ~15.4 km in 60s
 */

const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

/**
 * Extrapolate aircraft position forward in time.
 *
 * CRITICAL: This function always computes from the ORIGINAL confirmed lat/lon
 * (not from a previously extrapolated position). The caller must pass the
 * last confirmed API position, NOT the current display position.
 *
 * @param confirmedLat - Last confirmed API latitude (NOT an extrapolated one)
 * @param confirmedLon - Last confirmed API longitude (NOT an extrapolated one)
 * @param heading - Heading/track in degrees (0 = North)
 * @param speedKnots - Ground speed in knots
 * @param lastUpdateMs - Epoch ms of the last confirmed position
 * @param nowMs - Current epoch ms
 * @returns Extrapolated {latitude, longitude} or null if invalid
 */
export function extrapolatePosition(
  confirmedLat: number,
  confirmedLon: number,
  heading: number,
  speedKnots: number,
  lastUpdateMs: number,
  nowMs: number,
): { latitude: number; longitude: number } | null {
  // Validate inputs
  if (!isFinite(confirmedLat) || !isFinite(confirmedLon)) return null
  if (!isFinite(heading)) return null
  if (!isFinite(speedKnots) || speedKnots < 1) return null
  if (!isFinite(lastUpdateMs) || !isFinite(nowMs) || nowMs < lastUpdateMs) return null

  const elapsedMs = nowMs - lastUpdateMs
  // Don't extrapolate backward or by more than 5 minutes
  if (elapsedMs < 0 || elapsedMs > 300_000) return null

  // Convert speed from knots to meters per second
  const speedMps = speedKnots * 0.514444

  // Distance traveled in meters
  const elapsedSeconds = elapsedMs / 1000
  const distanceM = speedMps * elapsedSeconds

  // If the aircraft barely moved (< 1 meter), skip
  if (distanceM < 1) return null

  // ─── Diagnostic logging at realistic speeds ───
  // 250 kt × 0.514444 = 128.6 m/s
  // At 250 kt with 5s elapsed: 128.6 × 5 = 643 meters → expected
  // At 250 kt with 30s elapsed: 128.6 × 30 = 3858 meters → expected (between polls)

  // Haversine destination formula
  const latRad = toRad(confirmedLat)
  const lonRad = toRad(confirmedLon)
  const bearingRad = toRad(heading)
  const distRatio = distanceM / EARTH_RADIUS_M

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distRatio) +
    Math.cos(latRad) * Math.sin(distRatio) * Math.cos(bearingRad),
  )

  const newLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distRatio) * Math.cos(latRad),
      Math.cos(distRatio) - Math.sin(latRad) * Math.sin(newLatRad),
    )

  return {
    latitude: toDeg(newLatRad),
    longitude: toDeg(newLonRad),
  }
}