/**
 * Provider: ADSB.lol — radius-based aircraft data + global military feed.
 *
 * Normal: queries 6 grid cells covering Saudi Arabia (250nm radius each).
 * Military: fetches global military dump, filtered client-side to SA boundary.
 *
 * API docs: https://adsb.lol/docs
 * Rate limit: soft (~unlimited for reasonable usage)
 */

import type { AdsbAircraft, AdsbResponse, GridCell, ProviderHealth } from '../types'
import { fetchJson } from './fetch-json'
import { getRadiusGridCells, haversineDistance } from '../geography'

const BASE = '/api/adsb/v2'

interface ProviderState {
  cache: AdsbAircraft[]
  cacheTime: number
  health: ProviderHealth
  /** Separate cache for military endpoint — prevents sharing normal aircraft with /mil */
  milCache: AdsbAircraft[]
  milCacheTime: number
}

const state: ProviderState = {
  cache: [],
  cacheTime: 0,
  milCache: [],
  milCacheTime: 0,
  health: {
    consecutiveErrors: 0,
    backoffUntil: null,
    lastSuccessTime: null,
    rateLimitedUntil: null,
  },
}

/**
 * Fetch ADSB.lol normal aircraft across all grid cells.
 * Deduplicates internally by ICAO24 hex.
 */
export async function fetchAdsbLol(cells?: GridCell[]): Promise<AdsbAircraft[]> {
  const grid = cells ?? getRadiusGridCells()
  console.log(`[ADSB.lol] Querying ${grid.length} cells: ${grid.map(c => `${c.id}@(${c.latitude},${c.longitude},${c.radiusNm}nm)`).join(' | ')}`)

  const seen = new Map<string, AdsbAircraft>()
  const perCell: Record<string, number> = {}
  const results = await Promise.allSettled(
    grid.map(cell =>
      fetchRadius(`${BASE}/lat/${cell.latitude}/lon/${cell.longitude}/dist/${cell.radiusNm}`, 'adsbLol')
        .then(ac => { perCell[cell.id] = ac.length; return ac; })
    )
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      for (const ac of result.value) {
        if (ac.hex) seen.set(ac.hex.toLowerCase(), ac)
      }
    }
  }

  // Log per-cell counts + HAB-specific
  const habCount = grid.filter(c => c.id === 'hab').length > 0
  const habAircraft = Array.from(seen.values()).filter(ac =>
    ac.lat != null && ac.lon != null && haversineDistance(ac.lat, ac.lon, 28.4328, 45.9708) <= 250 * 1852
  )
  console.log(`[ADSB.lol] Per-cell: ${JSON.stringify(perCell)} total_unique=${seen.size} hab_cell_queried=${habCount} within_250nm_HAB=${habAircraft.length}`)

  const aircraft = Array.from(seen.values())
  if (aircraft.length > 0) {
    state.cache = aircraft
    state.cacheTime = Date.now()
    state.health.consecutiveErrors = 0
    state.health.backoffUntil = null
    state.health.lastSuccessTime = Date.now()
  }

  return aircraft.length > 0 ? aircraft : state.cache
}

/**
 * Fetch ADSB.lol military aircraft (global dump, cached 5 min).
 */
export async function fetchAdsbLolMilitary(): Promise<AdsbAircraft[]> {
  // Return mil-specific cache if still fresh
  if (state.milCache.length > 0 && Date.now() - state.milCacheTime < 300000) {
    return state.milCache
  }

  const data: AdsbResponse | null = await fetchJson(`${BASE}/mil`, 'adsbLolMil')
  if (!data?.ac) {
    // Preserve mil-specific cache on failure
    return state.milCache || []
  }

  state.milCache = data.ac
  state.milCacheTime = Date.now()
  return data.ac
}

async function fetchRadius(url: string, provider: string): Promise<AdsbAircraft[]> {
  const data: AdsbResponse | null = await fetchJson(url, provider)
  if (!data?.ac) return []
  return data.ac
}

export function getAdsbLolHealth(): ProviderHealth {
  return { ...state.health }
}

export function getAdsbLolCacheSize(): number {
  return state.cache.length
}

export function resetAdsbLolHealth(): void {
  state.health = {
    consecutiveErrors: 0,
    backoffUntil: null,
    lastSuccessTime: null,
    rateLimitedUntil: null,
  }
}