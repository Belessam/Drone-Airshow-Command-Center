/**
 * useSimulation — React hook that subscribes to the shared simulation runner.
 *
 * - Starts the simulation tick loop when any component mounts
 * - Stops the loop when the last component unmounts (via ref counting)
 * - Provides live estimated positions for all drones
 * - Provides per-drone freshness evaluation
 */

import { useState, useEffect, useCallback } from 'react'
import { simulationRunner } from '@/lib/simulation/runner'
import { evaluateFreshness, formatElapsed, getFreshnessWarning } from '@/lib/simulation/freshness'
import type { EstimatedPosition, FreshnessInfo } from '@/lib/simulation/types'
import type { Drone } from '@/types'

interface UseSimulationReturn {
  /** All estimated positions keyed by drone id */
  positions: Map<string, EstimatedPosition>
  /** All estimated positions as an array */
  positionsArray: EstimatedPosition[]
  /** Get position for a specific drone */
  getPosition: (droneId: string) => EstimatedPosition | undefined
  /** Get freshness info for a drone */
  getFreshness: (drone: Drone) => FreshnessInfo
  /** Get time since last confirmed update as string */
  getElapsedText: (drone: Drone) => string
  /** Get a warning message if data is stale */
  getWarning: (drone: Drone) => string | null
  /** Update the runner with current drone data */
  setDrones: (drones: Drone[]) => void
  /** Add/update a single drone in the simulation */
  upsertDrone: (drone: Drone) => void
  /** Remove a drone from the simulation */
  removeDrone: (droneId: string) => void
  /** Number of drones being simulated */
  count: number
  /** Whether the runner is active */
  isRunning: boolean
}

// Ref count for shared lifecycle — start on first mount, stop on last unmount
let refCount = 0

export function useSimulation(drones?: Drone[]): UseSimulationReturn {
  const [positions, setPositions] = useState<Map<string, EstimatedPosition>>(
    () => simulationRunner.getAllPositions(),
  )

  // Keep runner synced with drone data changes (handles init + updates)
  useEffect(() => {
    if (drones && drones.length > 0) {
      simulationRunner.setDrones(drones)
    }
  }, [drones])

  // Subscribe to runner updates
  useEffect(() => {
    const unsub = simulationRunner.onUpdate((updatedPositions) => {
      setPositions(new Map(updatedPositions))
    })
    return unsub
  }, [])

  // Shared lifecycle: start on first mount, stop on last unmount
  useEffect(() => {
    refCount++
    if (refCount === 1) {
      simulationRunner.start()
    }
    return () => {
      refCount--
      if (refCount <= 0) {
        simulationRunner.stop()
        refCount = 0
      }
    }
  }, [])

  const getPosition = useCallback(
    (droneId: string) => simulationRunner.getPosition(droneId),
    [],
  )

  const getFreshness = useCallback(
    (drone: Drone) => {
      const elapsed = (Date.now() - new Date(drone.last_confirmed_at).getTime()) / 1000
      return evaluateFreshness(elapsed)
    },
    [],
  )

  const getElapsedText = useCallback(
    (drone: Drone) => {
      const elapsed = (Date.now() - new Date(drone.last_confirmed_at).getTime()) / 1000
      return formatElapsed(elapsed)
    },
    [],
  )

  const getWarning = useCallback(
    (drone: Drone) => {
      const elapsed = (Date.now() - new Date(drone.last_confirmed_at).getTime()) / 1000
      const freshness = evaluateFreshness(elapsed)
      return getFreshnessWarning(freshness.level)
    },
    [],
  )

  return {
    positions,
    positionsArray: Array.from(positions.values()),
    getPosition,
    getFreshness,
    getElapsedText,
    getWarning,
    setDrones: simulationRunner.setDrones.bind(simulationRunner),
    upsertDrone: simulationRunner.upsertDrone.bind(simulationRunner),
    removeDrone: simulationRunner.removeDrone.bind(simulationRunner),
    count: simulationRunner.droneCount,
    isRunning: simulationRunner.isRunning,
  }
}
