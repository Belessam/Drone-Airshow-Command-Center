/**
 * Shared site store — a module-level singleton that ensures all
 * useSitesData() instances share the same site state across components.
 *
 * Without this, DashboardPage and SitesPage each have their own
 * independent useState for sites, so edits on the SitesPage never
 * propagate to the DashboardPage's map.
 *
 * Pattern: simple pub/sub with shared mutable state array.
 * Components subscribe on mount and unsubscribe on unmount.
 */

import type { Site } from '@/types'

type Listener = (sites: Site[]) => void

let sharedSites: Site[] = []
const listeners = new Set<Listener>()

export function getSharedSites(): Site[] {
  return sharedSites
}

export function setSharedSites(sites: Site[]): void {
  sharedSites = sites
  // Notify all subscribers
  for (const listener of listeners) {
    listener(sharedSites)
  }
}

export function subscribeToSites(listener: Listener): () => void {
  listeners.add(listener)
  // Immediately call with current value
  listener(sharedSites)
  return () => {
    listeners.delete(listener)
  }
}
