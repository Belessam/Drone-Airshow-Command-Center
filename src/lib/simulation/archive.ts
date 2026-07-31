/**
 * Simulation Segment Archival
 *
 * Archives simulation segments when a drone is updated.
 * In the site-relative model, the drone's position at archive time is
 * provided as a pre-computed position (from the runner's tick state).
 */

import type { DroneSimulationSegment } from '@/types'

export interface ArchiveSegmentInput {
  activeSegment: DroneSimulationSegment
  updateTimestamp: string
  /** Pre-computed position from the simulation engine */
  endLatitude: number
  endLongitude: number
}

export interface ArchiveSegmentResult {
  endLatitude: number
  endLongitude: number
  endedAt: string
}

/**
 * Archives an active segment using the pre-computed end position.
 * The caller computes the position (from the runner's site-relative engine).
 */
export function calculateArchiveEndPosition(
  input: ArchiveSegmentInput,
): ArchiveSegmentResult {
  return {
    endLatitude: input.endLatitude,
    endLongitude: input.endLongitude,
    endedAt: input.updateTimestamp,
  }
}

/**
 * Reconstruct a drone's position at a historical timestamp using archived segments.
 *
 * Given a timestamp T and a list of archived segments:
 * - If T is within a segment → return the segment's stored position data
 * - If T is before any segment → return null (no data)
 * - If T is after all segments → return the last segment's end position (or null)
 */
export function reconstructHistoricalPosition(
  segments: DroneSimulationSegment[],
  targetTimestamp: string,
): { latitude: number; longitude: number; segment: DroneSimulationSegment } | null {
  const targetMs = new Date(targetTimestamp).getTime()

  const sorted = [...segments].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  )

  for (const segment of sorted) {
    const startMs = new Date(segment.started_at).getTime()
    const endMs = segment.ended_at ? new Date(segment.ended_at).getTime() : Infinity

    if (targetMs >= startMs && targetMs <= endMs) {
      return {
        latitude: segment.end_latitude ?? segment.start_latitude,
        longitude: segment.end_longitude ?? segment.start_longitude,
        segment,
      }
    }

    if (segment.ended_at && targetMs === endMs && segment.end_latitude !== null) {
      return {
        latitude: segment.end_latitude,
        longitude: segment.end_longitude ?? segment.start_longitude,
        segment,
      }
    }
  }

  return null
}
