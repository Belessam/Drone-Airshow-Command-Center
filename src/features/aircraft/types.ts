/**
 * Aircraft classification based on available ADS-B metadata.
 */
export type AircraftClass = 'civilian' | 'military' | 'unknown'

/**
 * Provider health status.
 */
export type ProviderStatus = 'ok' | 'rate_limited' | 'error' | 'pending'

/**
 * Geographic bounding box (WSEN).
 */
export interface BoundingBox {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

/**
 * A single geographic grid cell for radius-limited API queries.
 */
export interface GridCell {
  /** Cell identifier, e.g. "nw", "ne" */
  id: string
  /** Center latitude */
  latitude: number
  /** Center longitude */
  longitude: number
  /** Query radius in nautical miles */
  radiusNm: number
  /** Human-readable label */
  label: string
}

/**
 * Normalized aircraft data from any ADS-B provider.
 */
export interface Aircraft {
  /** ICAO24 hex identifier (unique) */
  id: string
  /** Callsign (flight number) */
  callsign?: string
  /** Latitude */
  latitude: number
  /** Longitude */
  longitude: number
  /** Altitude in feet */
  altitude?: number
  /** Ground speed in knots */
  speed?: number
  /** Track / heading in degrees */
  heading?: number
  /** Vertical rate in feet/min */
  verticalRate?: number
  /** ICAO aircraft type code (e.g. B738) */
  aircraftType?: string
  /** Registration/tail number */
  registration?: string
  /** Classification: civilian, military, or unknown */
  classification: AircraftClass
  /** ALL contributing source provider names */
  sources: string[]
  /** Best available position/last-update timestamp (ms epoch) */
  lastSeen: number
  /** Best available position/last-update timestamp (ms epoch) — highest from pos_time / last_seen / updated_at */
  lastPositionUpdate: number
  /** Primary source for display purposes (first source that provided data) */
  source: string
}

/**
 * Raw aircraft entry from ADSB.lol / adsb.fi / airplanes.live API response.
 *
 * The ADSB.lol API returns:
 *   hex, flight, lat, lon, alt_baro, gs, track, baro_rate
 *   t — ISO timestamp string (e.g. "2024-01-15T12:34:56Z")
 *   seen — seconds ago a message was received (relative)
 *   seen_pos — seconds ago position was last updated (relative)
 *   r — registration
 *   mil — boolean
 *   type — aircraft type code
 *   messages — total messages received
 */
export interface AdsbAircraft {
  hex: string
  flight?: string
  lat?: number
  lon?: number
  alt_baro?: number | 'ground'
  gs?: number
  track?: number
  baro_rate?: number
  t?: string
  r?: string
  mil?: boolean
  type?: string
  /** Seconds ago a message was received (relative, from API) */
  seen?: number
  /** Seconds ago position was last updated (relative, from API) */
  seen_pos?: number
  /** Total messages count */
  messages?: number
}

/**
 * ADSB.lol-style API response shape.
 */
export interface AdsbResponse {
  ac: AdsbAircraft[]
  msg?: string
  now?: number
  total?: number
}

/**
 * OpenSky Network API response — states as array of arrays.
 */
export interface OpenSkyResponse {
  time: number
  states: (number | string | null)[][] | null
}

/**
 * Per-provider metrics for the diagnostics dashboard.
 */
export interface ProviderMetrics {
  /** Raw aircraft count returned by this provider */
  rawAircraft: number
  /** Unique aircraft (by ICAO24) from this provider, after internal dedup */
  uniqueAircraft: number
  /** Aircraft NOT seen from any other provider (exclusive contribution) */
  newUniqueAircraft: number
  /** Aircraft within Saudi Arabian airspace */
  saudiCount: number
  /** Military aircraft detected */
  militaryCount: number
  /** Timestamp of last successful data (ms epoch) */
  lastUpdate: number | null
  /** Current operational status */
  status: ProviderStatus
  /** Consecutive error count */
  errorCount: number
  /** Average response time in milliseconds */
  avgResponseTimeMs: number
  /** How many grid cells were queried */
  cellsQueried: number
}

/**
 * Merge pipeline diagnostics.
 */
export interface MergeDiagnostics {
  /** Number of providers that contributed data */
  providers: number
  /** Total raw aircraft across all providers before dedup */
  rawTotal: number
  /** Duplicate aircraft removed during merge */
  duplicatesRemoved: number
  /** Final unique aircraft count */
  finalUnique: number
  /** Civilian aircraft count */
  civilian: number
  /** Military aircraft count */
  military: number
  /** Unclassified aircraft count */
  unknown: number
  /** Aircraft seen by 2 or more providers */
  multiSourceCount: number
}

/**
 * Provider health tracking state.
 */
export interface ProviderHealth {
  /** Consecutive failed requests */
  consecutiveErrors: number
  /** Timestamp until which the provider is in backoff (ms epoch, null = not backing off) */
  backoffUntil: number | null
  /** Timestamp of last successful fetch (ms epoch) */
  lastSuccessTime: number | null
  /** Timestamp until which rate-limited (ms epoch, null = not rate limited) */
  rateLimitedUntil: number | null
}

/**
 * Hafar Al Batin coverage diagnostics.
 */
export interface HabCoverageDiagnostics {
  /** Per-provider raw aircraft count */
  perProviderRaw: Record<string, number>
  /** Per-provider aircraft near HAB */
  perProviderNearHab: Record<string, number>
  /** Aircraft inside HAB radius in final merged dataset */
  aircraftInRadius: number
  /** Total final aircraft count */
  totalFinal: number
  /** Priority radius in nautical miles */
  priorityRadiusNm: number
}

/**
 * Per-site coverage diagnostics.
 */
export interface SiteCoverageDiagnosticsEntry {
  code: string
  centerLat: number
  centerLon: number
  radiusNm: number
  aircraftCount: number
}

/**
 * Return type of fetchAllAircraft.
 */
export interface FetchAllResult {
  aircraft: Aircraft[]
  diagnostics: MergeDiagnostics
  providerMetrics: Record<string, ProviderMetrics>
  habDiagnostics: HabCoverageDiagnostics
  siteDiagnostics: SiteCoverageDiagnosticsEntry[]
}

/**
 * Provider fetch function signature.
 */
export type ProviderFetchFn = () => Promise<AdsbAircraft[]>

/**
 * Aircraft provider descriptor.
 */
export interface AircraftProviderDescriptor {
  name: string
  enabled: boolean
  pollIntervalMs: number
  description: string
}