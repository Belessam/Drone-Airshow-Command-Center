/**
 * Hook for managing sites data with real-time Supabase integration.
 * Provides loading/error states and all CRUD operations.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Site } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { fetchSites, createSite, updateSite, deleteSite as deleteSiteQuery } from '@/lib/supabase/queries'
import { isDemoMode, getDemoSites } from '@/utils/demoMode'
import { useAuth } from './useAuth'
import { setSharedSites } from '@/lib/siteStore'

interface UseSitesDataReturn {
  sites: Site[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createNewSite: (data: CreateSiteInput) => Promise<Site | null>
  editSite: (id: string, data: Partial<Site>) => Promise<Site | null>
  removeSite: (id: string) => Promise<boolean>
  droneCounts: Record<string, number>
}

export interface CreateSiteInput {
  name: string
  code: string
  color: string
  latitude: number
  longitude: number
  radius_km: number
  description?: string
}

export function useSitesData(): UseSitesDataReturn {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [droneCounts, setDroneCounts] = useState<Record<string, number>>({})
  const { canManageSites } = useAuth()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDemoMode()) {
        setSites(getDemoSites())
        setDroneCounts({
          'a0000000-0000-0000-0000-000000000001': 3,
          'a0000000-0000-0000-0000-000000000002': 2,
          'a0000000-0000-0000-0000-000000000003': 2,
          'a0000000-0000-0000-0000-000000000004': 2,
          'a0000000-0000-0000-0000-000000000005': 1,
        })
      } else {
        const data = await fetchSites()
        setSites(data)

        // Fetch active drone counts per site
        const { data: droneData, error: droneErr } = await supabase
          .from('drones')
          .select('source_site_id, is_active')
          .eq('is_active', true)

        if (!droneErr && droneData) {
          const counts: Record<string, number> = {}
          for (const d of droneData) {
            counts[d.source_site_id] = (counts[d.source_site_id] || 0) + 1
          }
          setDroneCounts(counts)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Sync sites to shared store whenever they change — this is what makes
  // edits on the SitesPage instantly visible on the DashboardPage map
  useEffect(() => {
    setSharedSites(sites)
  }, [sites])

  const removeSite = useCallback(async (id: string): Promise<boolean> => {
    if (!canManageSites) {
      setError('Only the Master Admin can delete sites.')
      return false
    }
    setError(null)
    try {
      if (isDemoMode()) {
        setSites((prev) => prev.filter((s) => s.id !== id))
        return true
      }
      await deleteSiteQuery(id)
      setSites((prev) => prev.filter((s) => s.id !== id))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete site'
      setError(message)
      return false
    }
  }, [canManageSites])

  const createNewSite = useCallback(async (data: CreateSiteInput): Promise<Site | null> => {
    if (!canManageSites) {
      setError('Only the Master Admin can manage sites.')
      return null
    }

    if (isDemoMode()) {
      const newSite: Site = {
        id: crypto.randomUUID(),
        name: data.name,
        code: data.code,
        color: data.color,
        latitude: data.latitude,
        longitude: data.longitude,
        radius_km: data.radius_km,
        description: data.description || null,
        is_active: true,
        gps_accuracy: null,
        location_verified: false,
        location_verified_at: null,
        address: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setSites((prev) => [...prev, newSite])
      return newSite
    }

    try {
      const site = await createSite({
        name: data.name,
        code: data.code,
        color: data.color,
        latitude: data.latitude,
        longitude: data.longitude,
        radius_km: data.radius_km,
        description: data.description || null,
        is_active: true,
        gps_accuracy: null,
        location_verified: false,
        location_verified_at: null,
        address: null,
      })
      setSites((prev) => [...prev, site])
      return site
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site')
      return null
    }
  }, [canManageSites])

  const editSite = useCallback(async (id: string, data: Partial<Site>): Promise<Site | null> => {
    if (!canManageSites) {
      setError('Only the Master Admin can edit sites.')
      return null
    }
    setError(null)

    if (isDemoMode()) {
      let updatedSite: any = null
      setSites((prev) => {
        const next = prev.map((s) => {
          if (s.id === id) {
            updatedSite = { ...s, ...data, updated_at: new Date().toISOString() }
            return updatedSite
          }
          return s
        })
        return next
      })
      if (updatedSite) {
        console.log('[SITE UPDATE] demo mode edit:', { id, data, result: `${updatedSite.code}|${updatedSite.color}` })
      }
      return updatedSite as Site | null
    }

    try {
      const site = await updateSite(id, data)
      console.log('[SITE UPDATE] Supabase edit success:', { id, data, result: `${site.code}|${site.color}` })
      setSites((prev) => prev.map((s) => (s.id === id ? site : s)))
      return site
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update site'
      setError(message)
      return null
    }
  }, [canManageSites])

  return {
    sites,
    loading,
    error,
    refresh,
    createNewSite,
    editSite,
    removeSite,
    droneCounts,
  }
}
