/**
 * Hook for managing drone data with Supabase integration.
 * Provides loading/error states, CRUD operations, and drone list management.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Drone, DroneUpdate, DroneEvent, Site } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { isDemoMode } from '@/utils/demoMode'
import { mockDrones, mockUpdates, mockEvents, mockSites } from '@/utils/mockData'
import { deleteDrone as deleteDroneQuery } from '@/lib/supabase/queries'
import { createDroneWithHistory, updateDroneWithHistory, getDemoDroneById, getAllDemoDrones } from '@/features/drones/droneService'
import { useAuth } from './useAuth'
import type { CreateDroneParams, UpdateDroneParams } from '@/features/drones/droneService'

interface UseDronesDataReturn {
  drones: Drone[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getDroneById: (id: string) => Drone | undefined
  getDronesBySite: (siteId: string) => Drone[]
  getSiteForDrone: (droneId: string) => Site | undefined
  createDrone: (params: CreateDroneParams) => Promise<Drone | null>
  updateDrone: (params: UpdateDroneParams) => Promise<Drone | null>
  deleteDrone: (id: string) => Promise<boolean>
  getDroneUpdates: (droneId: string) => DroneUpdate[]
  getDroneEvents: (droneId: string) => DroneEvent[]
}

export function useDronesData(): UseDronesDataReturn {
  const [drones, setDrones] = useState<Drone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDemoMode()) {
        const dynamicDrones = getAllDemoDrones()
        // Merge mockDrones with dynamically created ones (dynamic ones override by ID)
        const merged = [...mockDrones]
        for (const dd of dynamicDrones) {
          const idx = merged.findIndex((m) => m.id === dd.id)
          if (idx >= 0) merged[idx] = dd
          else merged.push(dd)
        }
        setDrones(merged)
      } else {
        const { data, error: fetchErr } = await supabase
          .from('drones')
          .select('*')
          .order('created_at', { ascending: false })

        if (fetchErr) throw fetchErr
        setDrones(data as Drone[])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, user?.id])

  const getDroneById = useCallback((id: string): Drone | undefined => {
    return drones.find((d) => d.id === id || d.drone_id === id)
  }, [drones])

  const getDronesBySite = useCallback((siteId: string): Drone[] => {
    return drones.filter((d) => d.source_site_id === siteId)
  }, [drones])

  const getSiteForDrone = useCallback((droneId: string): Site | undefined => {
    const drone = drones.find((d) => d.id === droneId || d.drone_id === droneId)
    if (!drone) return undefined
    if (isDemoMode()) {
      return mockSites.find((s) => s.id === drone.source_site_id)
    }
    return undefined // Will be fetched via join in later phases
  }, [drones])

  const createDrone = useCallback(async (params: CreateDroneParams): Promise<Drone | null> => {
    setError(null)
    try {
      const result = await createDroneWithHistory(params)
      // Add the new drone to local state
      setDrones((prev) => [result.drone, ...prev])
      return result.drone
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create drone'
      setError(message)
      return null
    }
  }, [])

  const updateDrone = useCallback(async (params: UpdateDroneParams): Promise<Drone | null> => {
    setError(null)
    try {
      const result = await updateDroneWithHistory(params)
      // Update the drone in local state
      setDrones((prev) => prev.map((d) => (d.id === result.drone.id ? result.drone : d)))
      return result.drone
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update drone'
      setError(message)
      return null
    }
  }, [])

  const deleteDrone = useCallback(async (id: string): Promise<boolean> => {
    setError(null)
    try {
      if (isDemoMode()) {
        setDrones((prev) => prev.filter((d) => d.id !== id))
        return true
      }
      // Pass user's site_id so non-admin users can only delete drones from their own site
      const siteId = user?.role === 'master_admin' ? undefined : user?.site_id ?? undefined
      await deleteDroneQuery(id, siteId)
      setDrones((prev) => prev.filter((d) => d.id !== id))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete drone'
      setError(message)
      return false
    }
  }, [user])

  const getDroneUpdates = useCallback((droneId: string): DroneUpdate[] => {
    if (isDemoMode()) {
      const drone = drones.find((d) => d.id === droneId || d.drone_id === droneId)
      if (!drone) return []
      // Return demo updates + any dynamically created ones
      const updates: DroneUpdate[] = [...mockUpdates.filter((u) => u.drone_id === drone.id)]
      // Add any from the demo service's internal state
      return updates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return []
  }, [drones])

  const getDroneEvents = useCallback((droneId: string): DroneEvent[] => {
    if (isDemoMode()) {
      const drone = drones.find((d) => d.id === droneId || d.drone_id === droneId)
      if (!drone) return []
      return mockEvents
        .filter((e) => e.drone_id === drone.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return []
  }, [drones])

  return {
    drones,
    loading,
    error,
    refresh,
    getDroneById,
    getDronesBySite,
    getSiteForDrone,
    createDrone,
    updateDrone,
    deleteDrone,
    getDroneUpdates,
    getDroneEvents,
  }
}
