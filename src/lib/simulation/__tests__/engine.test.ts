/**
 * Simulation Engine tests — verifying waypoint-based movement calculations.
 *
 * Run with: npx tsx src/lib/simulation/__tests__/engine.test.ts
 */

import { calculateDistance, calculateBearing, calculateDestinationPoint, interpolateAlongLeg } from '../engine'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`  ✅ PASS: ${message}`)
  }
}

function approxEqual(a: number, b: number, tolerance = 0.0001): boolean {
  return Math.abs(a - b) <= tolerance
}

function runTests() {
  console.log('\n=== SIMULATION ENGINE TESTS (WAYPOINT NAVIGATION) ===\n')

  // ================================================================
  // BEARING: NORTH (0°)
  // ================================================================
  console.log('\n--- Bearing: North (0°) ---')
  const north = calculateDestinationPoint(34.0, -118.0, 0, 1000)
  assert(
    north.latitude > 34.0,
    `Bearing north: latitude increases (${north.latitude} > 34.0)`,
  )
  assert(
    approxEqual(north.longitude, -118.0, 0.001),
    `Bearing north: longitude unchanged (${north.longitude} ≈ -118.0)`,
  )

  // ================================================================
  // BEARING: SOUTH (180°)
  // ================================================================
  console.log('\n--- Bearing: South (180°) ---')
  const south = calculateDestinationPoint(34.0, -118.0, 180, 1000)
  assert(south.latitude < 34.0, `Bearing south: latitude decreases (${south.latitude} < 34.0)`)

  // ================================================================
  // BEARING: EAST (90°)
  // ================================================================
  console.log('\n--- Bearing: East (90°) ---')
  const east = calculateDestinationPoint(34.0, -118.0, 90, 1000)
  assert(east.longitude > -118.0, `Bearing east: longitude increases (${east.longitude} > -118.0)`)

  // ================================================================
  // BEARING: WEST (270°)
  // ================================================================
  console.log('\n--- Bearing: West (270°) ---')
  const west = calculateDestinationPoint(34.0, -118.0, 270, 1000)
  assert(west.longitude < -118.0, `Bearing west: longitude decreases (${west.longitude} < -118.0)`)

  // ================================================================
  // DISTANCE ACCURACY — at equator, 1° lat ≈ 111km
  // ================================================================
  console.log('\n--- Distance Accuracy ---')
  const distNorth = calculateDestinationPoint(0, 0, 0, 360000)
  const expectedLat = 360000 / 111111
  assert(
    approxEqual(distNorth.latitude, expectedLat, 0.1),
    `Distance from equator north is ~${expectedLat.toFixed(2)}° (got ${distNorth.latitude.toFixed(4)}°)`,
  )

  // ================================================================
  // ZERO DISTANCE = start position
  // ================================================================
  console.log('\n--- Zero Distance ---')
  const zero = calculateDestinationPoint(30.0444, 31.2357, 45, 0)
  assert(approxEqual(zero.latitude, 30.0444, 0.000001), 'Zero distance returns start latitude')
  assert(approxEqual(zero.longitude, 31.2357, 0.000001), 'Zero distance returns start longitude')

  // ================================================================
  // DIAGONAL — Northeast (45°)
  // ================================================================
  console.log('\n--- Diagonal: Northeast (45°) ---')
  const ne = calculateDestinationPoint(34.0, -118.0, 45, 1000)
  assert(ne.latitude > 34.0, 'Northeast: latitude increases')
  assert(ne.longitude > -118.0, 'Northeast: longitude increases')

  // ================================================================
  // DISTANCE CALCULATION
  // ================================================================
  console.log('\n--- Distance Calculation ---')
  const d = calculateDistance(34.0, -118.0, 34.01, -118.0)
  assert(d > 1000 && d < 1200, `~1km north is ~1111m (got ${d.toFixed(0)}m)`)

  // ================================================================
  // BEARING CALCULATION
  // ================================================================
  console.log('\n--- Bearing Calculation ---')
  const b = calculateBearing(34.0, -118.0, 34.01, -118.0)
  assert(approxEqual(b, 0, 0.5), `Bearing north is 0° (got ${b.toFixed(1)}°)`)

  const bEast = calculateBearing(34.0, -118.0, 34.0, -117.99)
  assert(approxEqual(bEast, 90, 0.5), `Bearing east is 90° (got ${bEast.toFixed(1)}°)`)

  // ================================================================
  // INTERPOLATE ALONG LEG
  // ================================================================
  console.log('\n--- Interpolate Along Leg ---')
  const legDist = calculateDistance(30.0, 31.0, 30.1, 31.2)
  const mid = interpolateAlongLeg(30.0, 31.0, calculateBearing(30.0, 31.0, 30.1, 31.2), legDist, 0.5)
  assert(mid.latitude > 30.0 && mid.latitude < 30.1, 'Mid-leg latitude is between endpoints')
  assert(mid.longitude > 31.0 && mid.longitude < 31.2, 'Mid-leg longitude is between endpoints')

  const start = interpolateAlongLeg(30.0, 31.0, 45, legDist, 0.0)
  assert(approxEqual(start.latitude, 30.0, 0.0001), 'Zero progress = start lat')
  assert(approxEqual(start.longitude, 31.0, 0.0001), 'Zero progress = start lng')

  const end = interpolateAlongLeg(30.0, 31.0, calculateBearing(30.0, 31.0, 30.1, 31.2), legDist, 1.0)
  assert(approxEqual(end.latitude, 30.1, 0.01), 'Full progress ≈ destination lat')
  assert(approxEqual(end.longitude, 31.2, 0.01), 'Full progress ≈ destination lng')

  console.log('\n=== TESTS COMPLETE ===')
}

runTests()
