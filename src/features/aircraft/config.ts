/**
 * Aircraft tracking configuration — Full Saudi Arabia coverage.
 *
 * Geographic strategy:
 *   - Providers supporting bounding boxes (OpenSky) → full SA bounding box
 *   - Providers supporting only radius queries (ADSB.lol, adsb.fi) → 6-cell grid
 *   - Military endpoint (ADSB.lol) → global dump filtered by SA boundary
 *
 * Production: all API calls route through Vercel serverless function at /api/aircraft/proxy
 * Development: Vite dev proxy rewrites /api/adsb/*, /api/adsbfi/*, /api/opensky/*
 */

/**
 * Provider priority — higher = better record kept during merge
 */
export type ProviderPriority = 1 | 2 | 3 | 4 | 5

export interface ProviderConfig {
  enabled: boolean
  apiBase: string
  pollIntervalMs: number
  cacheTtlMs: number
  /** Source priority during merge scoring (higher = better) */
  priority: ProviderPriority
  /** Grid cells to query (for radius-based providers) */
  gridCells?: string[]
  /** Whether this provider uses bounding box instead of grid cells */
  usesBbox?: boolean
  /** Whether this provider fetches a global snapshot */
  usesSnapshot?: boolean
  /** For providers requiring auth */
  username?: string
  password?: string
  /** Single-request providers (not per-cell) use this */
  singleRequest?: boolean
}

export interface ProviderConfigMap {
  [key: string]: ProviderConfig
}

export const AIRCRAFT_CONFIG = {
  /** Stale aircraft threshold — increased to 180s to retain traffic crossing the region */
  staleThresholdMs: 180000,

  /** Provider-specific configurations — ordered by priority */
  providers: {
    /** ADSB.lol — primary radius-based provider, high coverage */
    adsbLol: {
      enabled: true,
      apiBase: '/api/adsb/v2',
      pollIntervalMs: 30000,
      cacheTtlMs: 60000,
      priority: 5 as ProviderPriority,
      milCacheTtlMs: 300000,
      gridCells: ['nw', 'nc', 'ne', 'cm', 'pg', 'sw', 'sc', 'se'],
    } as ProviderConfig & { milCacheTtlMs: number },

    /** adsb.fi — primary radius-based provider, strong coverage */
    adsbFi: {
      enabled: true,
      apiBase: '/api/adsbfi/v3',
      pollIntervalMs: 35000,
      cacheTtlMs: 60000,
      priority: 4 as ProviderPriority,
      gridCells: ['nw', 'nc', 'ne', 'cm', 'pg', 'sw', 'sc', 'se'],
    },

    /** OpenSky — bounding box provider, wide area */
    openSky: {
      enabled: true,
      apiBase: '/api/opensky',
      pollIntervalMs: 45000,
      cacheTtlMs: 60000,
      priority: 3 as ProviderPriority,
      usesBbox: true,
      singleRequest: true,
      username: import.meta.env.VITE_OPENSKY_USERNAME || '',
      password: import.meta.env.VITE_OPENSKY_PASSWORD || '',
    },

    /** Airplanes.live — global snapshot, lighter polling to respect rate limits */
    airplanesLive: {
      enabled: true,
      apiBase: '/api/airplaneslive',
      pollIntervalMs: 60000,
      cacheTtlMs: 120000,
      priority: 2 as ProviderPriority,
      // Use only HAB + site cells (not full grid) to reduce request count
      gridCells: ['hab'],
    },

    /** IntelSky — military-focused global snapshot, no key needed */
    intelSky: {
      enabled: true,
      apiBase: 'https://intelsky.org/api',
      pollIntervalMs: 60000,
      cacheTtlMs: 120000,
      priority: 1 as ProviderPriority,
      usesSnapshot: true,
      singleRequest: true,
    },
  } as ProviderConfigMap,
} as const