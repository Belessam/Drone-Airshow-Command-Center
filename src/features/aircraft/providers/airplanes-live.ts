/**
 * Provider: Airplanes.live — free ADS-B aggregator.
 *
 * API is compatible with ADSB.lol format (same response shape).
 * Uses radius-based queries across 6 Saudi Arabia grid cells.
 *
 * API docs: https://airplanes.live/docs
 * Rate limit: reasonable, free tier available
 */

import type { AdsbAircraft, AdsbResponse, GridCell, ProviderHealth } from '../types'
import { fetchJson } from './fetch-json'
import { getRadiusGridCells } from '../geography'

const BASE = '/api/airplaneslive'

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

export async function fetchAirplanesLive(cells?: GridCell[]): Promise<AdsbAircraft[]> {
  const grid = cells ?? getRadiusGridCells()
  const seen = new Map<string, AdsbAircraft>()
  const results = await Promise.allSettled(
    grid.map(cell =>
      fetchJson(
        `${BASE}/lat/${cell.latitude}/lon/${cell.longitude}/dist/${cell.radiusNm}`,
        'airplanesLive'
      )
    )
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const resp = result.value as AdsbResponse
      for (const ac of resp.ac ?? []) {
        if (ac.hex) seen.set(ac.hex.toLowerCase(), ac)
      }
    }
  }

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

export function getAirplanesLiveHealth(): ProviderHealth {
  return { ...state.health }
}

export function getAirplanesLiveCacheSize(): number {
  return state.cache.length
}

export function resetAirplanesLiveHealth(): void {
  state.health = {
    consecutiveErrors: 0,
    backoffUntil: null,
    lastSuccessTime: null,
    rateLimitedUntil: null,
  }
}