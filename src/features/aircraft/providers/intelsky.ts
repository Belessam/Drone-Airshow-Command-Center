/**
 * Provider: IntelSky — military-focused ADS-B aggregation.
 *
 * Specializes in military, government, and strategic aircraft.
 * Free public API — no key required. CORS enabled.
 *
 * API: https://intelsky.org/api-docs.php
 * Rate limit: per-IP throttling (429 if exceeded)
 */

import type { AdsbAircraft, ProviderHealth } from '../types'
import { haversineDistance } from '../geography'

const BASE = 'https://intelsky.org/api'

interface IntelSkyAircraft {
  hex: string
  flight?: string
  lat?: number
  lon?: number
  alt_baro?: number
  gs?: number
  track?: number
  type?: string
  r?: string
  mil?: boolean
}

interface IntelSkyResponse {
  status: string
  total: number
  now: number
  ac?: IntelSkyAircraft[]
}

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

/**
 * Fetch IntelSky global snapshot with CORS-friendly fetch.
 * Returns all aircraft in the snapshot.
 */
export async function fetchIntelSky(): Promise<AdsbAircraft[]> {
  const now = Date.now()

  // Check backoff
  if (state.health.rateLimitedUntil && now < state.health.rateLimitedUntil) {
    console.log('[IntelSky] rate-limited until', new Date(state.health.rateLimitedUntil).toISOString())
    return state.cache || []
  }

  console.log(`[IntelSky] GET ${BASE}`)
  const startTime = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(BASE, { signal: controller.signal })
    clearTimeout(timeout)
    const elapsed = Math.round(performance.now() - startTime)

    if (res.status === 429) {
      console.warn(`[IntelSky] Rate limited (429) after ${elapsed}ms`)
      state.health.rateLimitedUntil = Date.now() + 60000
      return state.cache || []
    }
    if (!res.ok) {
      console.warn(`[IntelSky] HTTP ${res.status} after ${elapsed}ms`)
      state.health.consecutiveErrors++
      return state.cache || []
    }

    const data: IntelSkyResponse = await res.json()
    console.log(`[IntelSky] ${res.status} ${elapsed}ms total=${data.total}`)

    if (!data.ac || data.ac.length === 0) {
      state.health.consecutiveErrors++
      return state.cache || []
    }

    // Convert to AdsbAircraft format
    const aircraft: AdsbAircraft[] = data.ac
      .filter(a => a.lat != null && a.lon != null)
      .map(a => ({
        hex: a.hex.toLowerCase(),
        flight: a.flight?.trim() || undefined,
        lat: a.lat!,
        lon: a.lon!,
        alt_baro: a.alt_baro,
        gs: a.gs,
        track: a.track,
        type: a.type,
        r: a.r,
        mil: a.mil === true,
      }))

    // Log HAB-specific counts
    const habCount = aircraft.filter(a =>
      haversineDistance(a.lat!, a.lon!, 28.4328, 45.9708) <= 250 * 1852
    ).length
    const saudiCount = aircraft.filter(a =>
      a.lat! >= 14 && a.lat! <= 33.5 && a.lon! >= 34 && a.lon! <= 57
    ).length
    console.log(`[IntelSky] Converted=${aircraft.length} Saudi=${saudiCount} Within_250nm_HAB=${habCount}`)

    state.cache = aircraft
    state.cacheTime = now
    state.health.consecutiveErrors = 0
    state.health.backoffUntil = null
    state.health.rateLimitedUntil = null
    state.health.lastSuccessTime = now

    return aircraft
  } catch (err: any) {
    clearTimeout(timeout)
    if (err?.name === 'AbortError') {
      console.warn('[IntelSky] Timeout after 15s')
    } else {
      console.warn('[IntelSky] Fetch failed:', err?.message ?? err)
    }
    state.health.consecutiveErrors++
    if (state.health.consecutiveErrors > 3) {
      state.health.rateLimitedUntil = Date.now() + 120000
    }
    return state.cache || []
  }
}

export function getIntelSkyHealth(): ProviderHealth {
  return { ...state.health }
}

export function getIntelSkyCacheSize(): number {
  return state.cache.length
}

export function resetIntelSkyHealth(): void {
  state.health = {
    consecutiveErrors: 0,
    backoffUntil: null,
    lastSuccessTime: null,
    rateLimitedUntil: null,
  }
}
