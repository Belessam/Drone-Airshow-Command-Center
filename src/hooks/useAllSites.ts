/**
 * useAllSites — resolve the authoritative site list for the current user,
 * independent of which page mounted the data hooks.
 *
 * Why this exists:
 *   The DroneDetailPanel "SITE RELATIONSHIPS" section previously read sites
 *   from `useAuth().sites`, which is only populated on pages that ran
 *   `fetchSites()` inside AuthContext. On pages like DronesPage, or before
 *   the context fetch resolves, that array is empty — so the panel showed
 *   "No sites configured." for drones that DO have a source_site_id.
 *
 * Sources, in priority order:
 *   1. Shared site store (set by useSitesData on the Dashboard / SitesPage)
 *   2. Direct Supabase `sites` SELECT (authoritative — RLS allows any
 *      authenticated user to read sites, so this never fails for a valid user)
 *   3. Demo sites (demo mode only)
 *
 * All authenticated users can read sites (RLS policy "Anyone can read sites"),
 * so this is safe for every role and does NOT weaken RBAC — it only resolves
 * display information for a drone the user is already authorized to view.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Site } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { getSharedSites, subscribeToSites } from '@/lib/siteStore'
import { isDemoMode, getDemoSites } from '@/utils/demoMode'

export function useAllSites(): Site[] {
  const [sites, setSites] = useState<Site[]>(() =>
    isDemoMode() ? getDemoSites() : getSharedSites(),
  )

  useEffect(() => {
    // 1. Live-sync from the shared store (Dashboard/SitesPage keep it warm).
    const unsub = subscribeToSites((shared) => {
      if (isDemoMode()) {
        setSites(getDemoSites())
      } else if (shared.length > 0) {
        setSites(shared)
      }
    })
    return unsub
  }, [])

  // 2. Authoritative DB fallback — fills in whenever the store is empty and
  //    the panel needs a real site list (e.g. DronesPage which never mounted
  //    useSitesData). Idempotent: does nothing if sites are already known.
  useEffect(() => {
    if (isDemoMode()) return
    let active = true
    const load = async () => {
      const current = getSharedSites()
      if (current.length > 0) return
      try {
        const { data, error } = await supabase
          .from('sites')
          .select('*')
          .order('code', { ascending: true })
        if (active && !error && data && data.length > 0) {
          setSites(data as Site[])
        }
      } catch {
        /* keep whatever the store has */
      }
    }
    load()
    return () => { active = false }
  }, [])

  return sites
}
