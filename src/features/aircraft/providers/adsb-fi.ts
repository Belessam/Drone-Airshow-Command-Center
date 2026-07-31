/**
 * Provider: adsb.fi — open ADS-B data aggregator.
 *
 * API: radius-based queries (same format as ADSB.lol).
 * Queries 6 grid cells covering Saudi Arabia, deduplicates internally.
 *
 * API docs: https://opendata.adsb.fi/docs
 * Rate limit: ~unlimited for reasonable usage
 */

import type { AdsbAircraft, AdsbResponse, GridCell, ProviderHealth } from '../types'
import { fetchJson } from './fetch-json'
import { getRadiusGridCells, haversineDistance } from '../geography'

const BASE = '/api/adsbfi/v3'

interface ProviderState {
  cache: AdsbAircraft[]
  cacheTime: number
  health: ProviderHealth
}

const state: ProviderState = {
  cache: [],
  cacheTime: 0,
  health: {
    consecutiveErrors: 0,
    backoffUntil: null,
    lastSuccessTime: null,
    rateLimitedUntil: null,
  },
}

export async function fetchAdsbFi(cells?: GridCell[]): Promise<AdsbAircraft[]> {
  const grid = cells ?? getRadiusGridCells()
  console.log(`[adsb.fi] Querying ${grid.length} cells: ${grid.map(c => `${c.id}@(${c.latitude},${c.longitude},${c.radiusNm}nm)`).join(' | ')}`)

  const seen = new Map<string, AdsbAircraft>()
  const perCell: Record<string, number> = {}
  const results = await Promise.allSettled(
    grid.map(async cell => {
      const resp = await fetchJson(
        `${BASE}/lat/${cell.latitude}/lon/${cell.longitude}/dist/${cell.radiusNm}`,
        'adsbFi'
      ) as AdsbResponse | null
      const count = resp?.ac?.length ?? 0
      perCell[cell.id] = count
      return resp?.ac ?? []
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      for (const ac of result.value) {
        if (ac.hex) seen.set(ac.hex.toLowerCase(), ac)
      }
    }
  }

  // Log per-cell counts + HAB-specific
  const habAircraft = Array.from(seen.values()).filter(ac =>
    ac.lat != null && ac.lon != null && haversineDistance(ac.lat, ac.lon, 28.4328, 45.9708) <= 250 * 1852
  )
  console.log(`[adsb.fi] Per-cell: ${JSON.stringify(perCell)} total_unique=${seen.size} within_250nm_HAB=${habAircraft.length}`)

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

export function getAdsbFiHealth(): ProviderHealth {
  return { ...state.health }
}

export function getAdsbFiCacheSize(): number {
  return state.cache.length
}

export function resetAdsbFiHealth(): void {
  state.health = {
    consecutiveErrors: 0,
    backoffUntil: null,
    lastSuccessTime: null,
    rateLimitedUntil: null,
  }
}