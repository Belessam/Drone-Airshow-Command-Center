/**
 * Archival tests — verifying simulation segment lifecycle correctness.
 *
 * Run with: npx tsx src/lib/simulation/__tests__/archive.test.ts
 */

import { calculateArchiveEndPosition, reconstructHistoricalPosition } from '../archive'
import type { DroneSimulationSegment } from '@/types'

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
  console.log('\n=== ARCHIVAL TESTS ===\n')

  // ================================================================
  // TEST 1: Archive accepts pre-computed end position
  // ================================================================
  console.log('\n--- 1. Archive stores provided end position ---')
  const baseTime = '2026-07-26T10:00:00.000Z'
  const updateTime = '2026-07-26T10:01:00.000Z'

  const activeSegment: DroneSimulationSegment = {
    id: 'seg-001',
    drone_id: 'd-001',
    started_at: baseTime,
    ended_at: null,
    start_latitude: 34.0,
    start_longitude: -118.0,
    end_latitude: null,
    end_longitude: null,
    heading: 0,
    speed_mps: 10,
    altitude: 200,
    started_by_update_id: 'upd-001',
    ended_by_update_id: null,
    created_at: baseTime,
  }

  // Pass pre-computed position (simulates runner output)
  const archiveResult = calculateArchiveEndPosition({
    activeSegment,
    updateTimestamp: updateTime,
    endLatitude: 34.0054,
    endLongitude: -118.0,
  })

  assert(
    approxEqual(archiveResult.endLatitude, 34.0054, 0.001),
    `Archive end latitude is north of start (${archiveResult.endLatitude} ≈ 34.0054)`,
  )
  assert(
    approxEqual(archiveResult.endLongitude, -118.0, 0.001),
    `Archive end longitude unchanged (${archiveResult.endLongitude} ≈ -118.0)`,
  )
  assert(
    archiveResult.endedAt === updateTime,
    `Archive ended_at equals update timestamp (${archiveResult.endedAt})`,
  )

  // ================================================================
  // TEST 2: Zero elapsed time returns segment start
  // ================================================================
  console.log('\n--- 2. Zero elapsed time returns segment start ---')
  const zeroResult = calculateArchiveEndPosition({
    activeSegment,
    updateTimestamp: baseTime,
    endLatitude: 34.0,
    endLongitude: -118.0,
  })
  assert(
    approxEqual(zeroResult.endLatitude, 34.0, 0.0001),
    `Zero elapsed: end latitude = start latitude (${zeroResult.endLatitude})`,
  )
  assert(
    approxEqual(zeroResult.endLongitude, -118.0, 0.0001),
    `Zero elapsed: end longitude = start longitude`,
  )

  // ================================================================
  // TEST 3: Historical position reconstruction inside a segment
  // ================================================================
  console.log('\n--- 3. Historical position reconstruction ---')
  const archivedSegments: DroneSimulationSegment[] = [
    {
      ...activeSegment,
      ended_at: updateTime,
      end_latitude: 34.0054,
      end_longitude: -118.0,
      ended_by_update_id: 'upd-002',
    },
  ]

  // Reconstruct at mid-point of segment
  const midTime = '2026-07-26T10:00:30.000Z'
  const reconstructed = reconstructHistoricalPosition(archivedSegments, midTime)

  assert(reconstructed !== null, 'Position can be reconstructed inside segment')

  // ================================================================
  // TEST 4: Reconstruction at segment end boundary
  // ================================================================
  console.log('\n--- 4. Historical position at segment end boundary ---')
  const endReconstructed = reconstructHistoricalPosition(archivedSegments, updateTime)
  assert(endReconstructed !== null, 'Position can be reconstructed at segment end')
  if (endReconstructed) {
    assert(
      approxEqual(endReconstructed.latitude, 34.0054, 0.0001),
      `Reconstructed end position matches archive end (${endReconstructed.latitude} ≈ 34.0054)`,
    )
  }

  // ================================================================
  // TEST 5: Reconstruction before any segment returns null
  // ================================================================
  console.log('\n--- 5. Reconstruction before segment start returns null ---')
  const beforeTime = '2026-07-26T09:59:00.000Z'
  const beforeResult = reconstructHistoricalPosition(archivedSegments, beforeTime)
  assert(beforeResult === null, 'Before first segment returns null')

  // ================================================================
  // TEST 6: Multiple segments chain correctly
  // ================================================================
  console.log('\n--- 6. Multiple segment chain ---')
  const seg2Start = '2026-07-26T10:02:00.000Z'
  const seg2: DroneSimulationSegment = {
    id: 'seg-002',
    drone_id: 'd-001',
    started_at: seg2Start,
    ended_at: null,
    start_latitude: 34.01,
    start_longitude: -118.0,
    end_latitude: null,
    end_longitude: null,
    heading: 90,
    speed_mps: 20,
    altitude: 300,
    started_by_update_id: 'upd-002',
    ended_by_update_id: null,
    created_at: seg2Start,
  }

  const chain = [...archivedSegments, seg2]
  const gapTime = '2026-07-26T10:01:30.000Z'
  const gapResult = reconstructHistoricalPosition(chain, gapTime)
  assert(gapResult === null, 'Position in uncovered gap between segments returns null')

  console.log('\n=== ARCHIVAL TESTS COMPLETE ===')
}

runTests()
