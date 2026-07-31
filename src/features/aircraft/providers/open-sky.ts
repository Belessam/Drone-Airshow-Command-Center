/**
 * Provider: OpenSky Network — bounding-box-based aircraft data.
 *
 * Uses the full Saudi Arabia bounding box (single query).
 * Has heavy rate limits for anonymous users (~400 calls/day).
 * With free registration (username/password in env): ~4000 calls/day.
 *
 * Data format differs from ADSB.lol — positional arrays converted to AdsbAircraft.
 *
 * API docs: https://openskynetwork.github.io/opensky-api/
 * Rate limit: 400 / day (anonymous) or 4000 / day (authenticated)
 */

import type { AdsbAircraft, OpenSkyResponse, ProviderHealth } from '../types'
import { openSkyBboxParams, haversineDistance } from '../geography'

const BASE = '/api/opensky'

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
 * Map an OpenSky state array to our internal AdsbAircraft format.
 *
 * OpenSky states array index mapping:
 *   0: icao24          (string)
 *   1: callsign        (string | null)
 *   2: origin_country  (string)
 *   3: time_position   (int | null)
 *   4: last_contact    (int | null)
 *   5: longitude       (float | null)
 *   6: latitude        (float | null)
 *   7: baro_altitude   (float | null)
 *   8: on_ground       (boolean)
 *   9: velocity        (float | null)
 *  10: true_track      (float | null)
 *  11: vertical_rate   (float | null)
 *  12: sensors         (int[] | null)
 *  13: geo_altitude    (float | null)
 *  14: squawk          (string | null)
 *  15: spi             (boolean)
 *  16: position_source (int)
 *  17: category        (int | null)
 */
function openSkyToAdsb(
  s: (number | string | null)[],
  now: number,
): AdsbAircraft | null {
  const icao24 = s[0] as string
  const lat = s[6] as number | null
  const lon = s[5] as number | null
  const timePosition = s[3] as number | null // Unix seconds
  const lastContact = s[4] as number | null   // Unix seconds

  if (!icao24 || lat == null || lon == null) return null

  return {
    hex: icao24,
    flight: (s[1] as string)?.trim() || undefined,
    lat,
    lon,
    alt_baro: typeof s[7] === 'number' ? s[7] : undefined,
    gs: typeof s[9] === 'number' ? s[9] : undefined,
    track: typeof s[10] === 'number' ? s[10] : undefined,
    baro_rate: typeof s[11] === 'number' ? s[11] : undefined,
    r: (s[14] as string) || undefined,
    // No military classification in OpenSky data
    mil: undefined,
    // OpenSky doesn't provide aircraft type code directly
    type: undefined,
    // Convert absolute Unix epoch timestamps to seconds-ago (relative)
    // so the unified timestamp parser can handle them
    seen_pos: timePosition ? Math.max(0, Math.round((Date.now() - timePosition * 1000) / 1000)) : undefined,
    seen: lastContact ? Math.max(0, Math.round((Date.now() - lastContact * 1000) / 1000)) : undefined,
  }
}

export async function fetchOpenSky(): Promise<AdsbAircraft[]> {
  const now = Date.now()

  // Check backoff from rate limits
  if (state.health.rateLimitedUntil && now < state.health.rateLimitedUntil) {
    console.log('[AIRCRAFT] OpenSky: rate-limited until', new Date(state.health.rateLimitedUntil).toISOString())
    return state.cache || []
  }

  const params = openSkyBboxParams()
  const url = `${BASE}/states/all?${params}`

  // Build auth header from env credentials if available
  const username = import.meta.env.VITE_OPENSKY_USERNAME
  const password = import.meta.env.VITE_OPENSKY_PASSWORD
  const headers: Record<string, string> = {}
  if (username && password) {
    headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`)
  }

  // Use fetch directly so we can send auth headers
  console.log(`[AIRCRAFT] [openSky] GET ${url}`)
  const startTime = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(url, { signal: controller.signal, headers })
    clearTimeout(timeout)
    const elapsed = Math.round(performance.now() - startTime)

    if (res.status === 420 || res.status === 429) {
      console.warn(`[AIRCRAFT] [openSky] Rate limited (${res.status}) after ${elapsed}ms`)
      state.health.rateLimitedUntil = Date.now() + 60000
      return state.cache || []
    }
    if (!res.ok) {
      console.warn(`[AIRCRAFT] [openSky] HTTP ${res.status} after ${elapsed}ms`)
      state.health.consecutiveErrors++
      if (state.health.consecutiveErrors > 2) {
        state.health.rateLimitedUntil = Date.now() + 60000 * Math.min(state.health.consecutiveErrors, 10)
      }
      return state.cache || []
    }

    console.log(`[AIRCRAFT] [openSky] ${res.status} ${elapsed}ms`)
    const data: OpenSkyResponse = await res.json()

    if (!data?.states) {
      state.health.consecutiveErrors++
      if (state.health.consecutiveErrors > 2) {
        state.health.rateLimitedUntil = Date.now() + 60000 * Math.min(state.health.consecutiveErrors, 10)
      }
      return state.cache || []
    }

    const aircraft: AdsbAircraft[] = []
    for (const s of data.states) {
      const ac = openSkyToAdsb(s, now)
      if (ac) aircraft.push(ac)
    }

    // Log HAB-specific counts
    const habAircraft = aircraft.filter(ac =>
      ac.lat != null && ac.lon != null && haversineDistance(ac.lat, ac.lon, 28.4328, 45.9708) <= 250 * 1852
    )
    const saudiAircraft = aircraft.filter(ac =>
      ac.lat != null && ac.lon != null && ac.lat >= 14.0 && ac.lat <= 33.5 && ac.lon >= 34.0 && ac.lon <= 57.0
    )
    console.log(`[openSky] Raw=${aircraft.length} Saudi_bbox=${saudiAircraft.length} Within_250nm_HAB=${habAircraft.length}`)

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
      console.warn('[AIRCRAFT] [openSky] Timeout after 12s')
    } else {
      console.warn('[AIRCRAFT] [openSky] Fetch failed:', err?.message ?? err)
    }
    state.health.consecutiveErrors++
    return state.cache || []
  }
}

export function getOpenSkyHealth(): ProviderHealth {
  return { ...state.health }
}

export function getOpenSkyCacheSize(): number {
  return state.cache.length
}

export function resetOpenSkyHealth(): void {
  state.health = {
    consecutiveErrors: 0,
    backoffUntil: null,
    lastSuccessTime: null,
    rateLimitedUntil: null,
  }
}