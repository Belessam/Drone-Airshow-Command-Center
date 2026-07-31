/**
 * Aircraft service — multi-provider ADS-B aircraft aggregator.
 *
 * Providers:
 *   ADSB.lol       — radius-based across 6 grid cells + military global dump
 *   adsb.fi        — radius-based across 6 grid cells
 *   OpenSky        — bounding box (full Saudi Arabia)
 *   Airplanes.live — radius-based across 6 grid cells
 *
 * All requests go through the Vite dev proxy (development) or
 * Vercel API routes (production) to avoid CORS issues.
 *
 * Pipeline:
 *   1. Parallel provider fetches (each may query multiple grid cells)
 *   2. Client-side deduplication by ICAO24 within each provider
 *   3. Global merge: dedup by ICAO24, best metadata wins
 *   4. Timestamp-based freshness: pos_time > last_seen > updated > provider fetch time
 *   5. Multi-source tracking: all contributing sources stored per aircraft
 *   6. Saudi Arabia boundary filter applied final
 *   7. Diagnostics computed and returned
 */

import { AIRCRAFT_CONFIG } from './config'
import { shouldIncludeAircraft, getAllRadiusGridCells, setSiteLocations, getSiteLocations, computeSiteCoverage, computeHafrCoverage, isNearHafarAlBatin, isNearAnySite, isInSaudiAirspace, haversineDistance } from './geography'
import { computeProviderMetrics, computeMergeDiagnostics, logProviderMetrics, logMergeDiagnostics, errorProviderMetrics } from './diagnostics'
import { fetchAdsbLol, fetchAdsbLolMilitary, getAdsbLolHealth } from './providers/adsb-lol'
import { fetchAdsbFi, getAdsbFiHealth } from './providers/adsb-fi'
import { fetchOpenSky, getOpenSkyHealth } from './providers/open-sky'
import { fetchAirplanesLive, getAirplanesLiveHealth } from './providers/airplanes-live'
import { fetchIntelSky, getIntelSkyHealth } from './providers/intelsky'
import { getBestTimestamp, computePositionTimestamp } from './timestamps'
import type {
  Aircraft,
  AdsbAircraft,
  ProviderMetrics,
  MergeDiagnostics,
  FetchAllResult,
  ProviderHealth,
} from './types'

// ─── In-flight tracking per provider ───

const inflightFlags: Record<string, boolean> = {}

// ─── Generic fetch guard ───

async function guardedFetch<T>(
  name: string,
  fetchFn: () => Promise<T>,
  onResult: (data: T) => void,
): Promise<{ data: T | null; responseTimeMs: number; isFromCache: boolean }> {
  const start = performance.now()
  if (inflightFlags[name]) {
    console.log(`[AIRCRAFT] ${name}: in flight, skipping`)
    return { data: null, responseTimeMs: 0, isFromCache: true }
  }
  inflightFlags[name] = true
  try {
    const data = await fetchFn()
    const elapsed = Math.round(performance.now() - start)
    onResult(data)
    return { data, responseTimeMs: elapsed, isFromCache: false }
  } finally {
    inflightFlags[name] = false
  }
}

// ─── Normalize raw aircraft to internal Aircraft type ───

function normalize(ac: AdsbAircraft, source: string, serverNowMs: number): Aircraft | null {
  if (ac.lat == null || ac.lon == null) return null
  const id = ac.hex?.toLowerCase()
  if (!id) return null

  const posTimestamp = computePositionTimestamp(ac, serverNowMs)

  return {
    id,
    callsign: ac.flight?.trim() || undefined,
    latitude: ac.lat,
    longitude: ac.lon,
    altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : undefined,
    speed: ac.gs,
    heading: ac.track,
    verticalRate: ac.baro_rate,
    aircraftType: ac.type || undefined,
    registration: ac.r || undefined,
    classification: ac.mil === true ? 'military' : 'unknown',
    sources: [source],
    source,
    lastSeen: posTimestamp,
    lastPositionUpdate: posTimestamp,
  }
}

// ─── Global merge pipeline ───

/**
 * HAB/Site trace logging for individual aircraft in the merge pipeline.
 * Logs position relative to Hafar Al Batin (28.4328, 45.9708) and all Sites.
 */
function shouldIncludeAircraftTrace(
  lat: number,
  lon: number,
  id: string,
  source: string,
): boolean {
  const habDist = haversineDistance(lat, lon, 28.4328, 45.9708)
  const habRadius = 100 * 1852 // 100nm
  const nearHab = habDist <= habRadius
  const inSaudi = isInSaudiAirspace(lat, lon)
  const nearSite = isNearAnySite(lat, lon)

  // Log every HAB-near aircraft unconditionally
  if (nearHab) {
    console.log(
      `[HAB TRACE] ICAO=${id} Source=${source} ` +
      `Pos=(${lat.toFixed(4)},${lon.toFixed(4)}) ` +
      `DistFromHAB=${(habDist / 1852).toFixed(1)}nm ` +
      `inSaudi=${inSaudi} nearHab=${nearHab} nearSite=${nearSite} ` +
      `ACTION=INCLUDED`
    )
  } else if (inSaudi || nearSite) {
    // Also log any aircraft near a Site
    console.log(
      `[SITE TRACE] ICAO=${id} Source=${source} ` +
      `Pos=(${lat.toFixed(4)},${lon.toFixed(4)}) ` +
      `inSaudi=${inSaudi} nearSite=${nearSite} ` +
      `ACTION=INCLUDED`
    )
  }

  return inSaudi || nearHab || nearSite
}

function mergeAllProviders(
  rawArrays: { source: string; aircraft: AdsbAircraft[] }[],
  serverNowMs: number,
): Aircraft[] {
  const seen = new Map<string, Aircraft>()
  let totalBeforeFilter = 0
  let excludedByGeo = 0
  let excludedNoPos = 0

  for (const { source, aircraft } of rawArrays) {
    for (const ac of aircraft) {
      const id = ac.hex?.toLowerCase()
      if (!id || ac.lat == null || ac.lon == null) { excludedNoPos++; continue }
      totalBeforeFilter++

      // Geographic inclusion check — OR-based
      // Include if: inside SA airspace OR near Hafar Al Batin OR near any Site
      if (!shouldIncludeAircraftTrace(ac.lat, ac.lon, id, source)) {
        excludedByGeo++
        continue
      }

      const existing = seen.get(id)
      const acTimestamp = computePositionTimestamp(ac, serverNowMs)

      if (existing) {
        // Check if this existing aircraft was marked as HAB-near and is being overwritten
        const existingHabDist = haversineDistance(existing.latitude, existing.longitude, 28.4328, 45.9708)
        const newHabDist = haversineDistance(ac.lat!, ac.lon!, 28.4328, 45.9708)
        if (newHabDist <= 100 * 1852 || existingHabDist <= 100 * 1852) {
          console.log(
            `[HAB TRACE DEDUP] ICAO=${id} ` +
            `existingSource=${existing.source} existingPos=(${existing.latitude.toFixed(4)},${existing.longitude.toFixed(4)}) existingHabDist=${(existingHabDist / 1852).toFixed(1)}nm ` +
            `newSource=${source} newPos=(${ac.lat!.toFixed(4)},${ac.lon!.toFixed(4)}) newHabDist=${(newHabDist / 1852).toFixed(1)}nm ` +
            `existingTs=${existing.lastPositionUpdate} newTs=${acTimestamp} ` +
            `existingSpeed=${existing.speed} newSpeed=${ac.gs}`
          )
        }

        // Add source to multi-source tracking
        if (!existing.sources.includes(source)) {
          existing.sources.push(source)
        }

        // Freshness: keep the record with the best timestamp
        if (acTimestamp > existing.lastPositionUpdate) {
          existing.latitude = ac.lat
          existing.longitude = ac.lon
          existing.altitude = typeof ac.alt_baro === 'number' ? ac.alt_baro : existing.altitude
          existing.speed = ac.gs ?? existing.speed
          existing.heading = ac.track ?? existing.heading
          existing.verticalRate = ac.baro_rate ?? existing.verticalRate
          existing.lastSeen = acTimestamp
          existing.lastPositionUpdate = acTimestamp
        }

        existing.aircraftType = ac.type || existing.aircraftType
        existing.registration = ac.r || existing.registration
        existing.callsign = ac.flight?.trim() || existing.callsign

        if (ac.mil === true) {
          existing.classification = 'military'
        } else if (existing.classification === 'unknown' && ac.flight) {
          existing.classification = 'civilian'
        }
      } else {
        const normalized = normalize(ac, source, serverNowMs)
        if (normalized) {
          seen.set(id, normalized)
        }
      }
    }
  }

  // Final pass
  for (const ac of seen.values()) {
    if (ac.classification === 'unknown' && ac.callsign) {
      ac.classification = 'civilian'
    }
  }

  const result = Array.from(seen.values())

  // ── PIPELINE INSTRUMENTATION ──
  const habBefore = result.filter(ac => haversineDistance(ac.latitude, ac.longitude, 28.4328, 45.9708) <= 100 * 1852).length
  const hab250 = result.filter(ac => haversineDistance(ac.latitude, ac.longitude, 28.4328, 45.9708) <= 250 * 1852).length
  const inSaudi = result.filter(ac => ac.latitude >= 14 && ac.latitude <= 33.5 && ac.longitude >= 34 && ac.longitude <= 57).length
  console.log(
    `[MERGE PIPELINE] raw=${totalBeforeFilter} no_pos=${excludedNoPos} geo_excluded=${excludedByGeo} ` +
    `post_merge=${result.length} in_saudi=${inSaudi} within_100nm_HAB=${habBefore} within_250nm_HAB=${hab250}`
  )

  return result
}

// ─── Provider fetch helpers ───

async function traceProvider(
  name: string,
  fetchFn: () => Promise<AdsbAircraft[]>,
  allIcaosBefore: Set<string>,
  cellsQueried: number,
): Promise<{ data: AdsbAircraft[] | null; metrics: ProviderMetrics }> {
  const start = performance.now()
  const result = await guardedFetch<AdsbAircraft[]>(name, fetchFn, () => {})
  const elapsed = Math.round(performance.now() - start)

  const aircraftList = result.data

  if (!aircraftList || aircraftList.length === 0) {
    return { data: null, metrics: errorProviderMetrics(name, 1) }
  }

  const metrics = computeProviderMetrics(
    name,
    aircraftList,
    allIcaosBefore,
    elapsed,
    cellsQueried,
  )

  logProviderMetrics(name, metrics)
  return { data: aircraftList, metrics }
}

// ─── Type guard for AdsbAircraft ───

function isAdsbArray(v: any): v is AdsbAircraft[] {
  return Array.isArray(v) && (v.length === 0 || 'hex' in v[0] || 'lat' in v[0])
}

// ─── Main entry point ───

export async function fetchAllAircraft(): Promise<FetchAllResult> {
  const gridCells = getAllRadiusGridCells()
  const providerMetrics: Record<string, ProviderMetrics> = {}
  const allIcaosBefore = new Set<string>()
  const rawContributions: { source: string; aircraft: AdsbAircraft[] }[] = []

  let rawTotal = 0

  // Log grid diagnostics
  console.log(`[GEOGRAPHY] Querying ${gridCells.length} cells: ${gridCells.map(c => c.id).join(', ')}`)
  console.log(`[GEOGRAPHY] Site locations loaded: ${getSiteLocations().length}`)

  // ── Provider 1: ADSB.lol ──
  if (AIRCRAFT_CONFIG.providers.adsbLol.enabled) {
    const { data, metrics } = await traceProvider(
      'adsbLol',
      () => fetchAdsbLol(gridCells),
      allIcaosBefore,
      gridCells.length,
    )
    providerMetrics.adsbLol = metrics
    if (data && isAdsbArray(data)) {
      // Add to global ICAO tracking
      for (const ac of data) {
        if (ac.hex) allIcaosBefore.add(ac.hex.toLowerCase())
      }
      rawTotal += data.length
      rawContributions.push({ source: 'adsb.lol', aircraft: data })
    }

    // ── ADSB.lol Military ──
    const milData = await fetchAdsbLolMilitary()
    if (milData.length > 0) {
      const milRaw = milData
      for (const ac of milRaw) {
        if (ac.hex) allIcaosBefore.add(ac.hex.toLowerCase())
      }
      rawTotal += milRaw.length
      rawContributions.push({ source: 'adsb.lol.mil', aircraft: milRaw })
      providerMetrics.adsbLolMil = computeProviderMetrics(
        'adsbLolMil',
        milRaw,
        new Set(),
        0,
        1,
      )
      logProviderMetrics('adsbLolMil', providerMetrics.adsbLolMil)
    }
  }

  // ── Provider 2: adsb.fi ──
  if (AIRCRAFT_CONFIG.providers.adsbFi.enabled) {
    const { data, metrics } = await traceProvider(
      'adsbFi',
      () => fetchAdsbFi(gridCells),
      allIcaosBefore,
      gridCells.length,
    )
    providerMetrics.adsbFi = metrics
    if (data && isAdsbArray(data)) {
      for (const ac of data) {
        if (ac.hex) allIcaosBefore.add(ac.hex.toLowerCase())
      }
      rawTotal += data.length
      rawContributions.push({ source: 'adsb.fi', aircraft: data })
    }
  }

  // ── Provider 3: OpenSky Network ──
  if (AIRCRAFT_CONFIG.providers.openSky.enabled) {
    const { data, metrics } = await traceProvider(
      'openSky',
      () => fetchOpenSky(),
      allIcaosBefore,
      1,
    )
    providerMetrics.openSky = metrics
    if (data && isAdsbArray(data)) {
      for (const ac of data) {
        if (ac.hex) allIcaosBefore.add(ac.hex.toLowerCase())
      }
      rawTotal += data.length
      rawContributions.push({ source: 'openSky', aircraft: data })
    }
  }

  // ── Provider 4: Airplanes.live ──
  if (AIRCRAFT_CONFIG.providers.airplanesLive.enabled) {
    const { data, metrics } = await traceProvider(
      'airplanesLive',
      () => fetchAirplanesLive(gridCells),
      allIcaosBefore,
      gridCells.length,
    )
    providerMetrics.airplanesLive = metrics
    if (data && isAdsbArray(data)) {
      for (const ac of data) {
        if (ac.hex) allIcaosBefore.add(ac.hex.toLowerCase())
      }
      rawTotal += data.length
      rawContributions.push({ source: 'airplanes.live', aircraft: data })
    }
  }

  // ── Provider 5: IntelSky Military/Global ──
  if (AIRCRAFT_CONFIG.providers.intelSky?.enabled) {
    const intelSkyEnabled = AIRCRAFT_CONFIG.providers.intelSky.enabled
    if (intelSkyEnabled) {
      const { data, metrics } = await traceProvider(
        'intelSky',
        () => fetchIntelSky(),
        allIcaosBefore,
        1,
      )
      providerMetrics.intelSky = metrics
      if (data && data.length > 0) {
        for (const ac of data) {
          if (ac.hex) allIcaosBefore.add(ac.hex.toLowerCase())
        }
        rawTotal += data.length
        rawContributions.push({ source: 'intelSky', aircraft: data })
      }
    }
  }

  // ── PRE-MERGE INSTRUMENTATION ──
  console.log(`[PIPELINE] Total raw across all providers: ${rawTotal}`)
  for (const { source, aircraft } of rawContributions) {
    let habCount = 0
    let siteCount = 0
    let saudiCount = 0
    for (const ac of aircraft) {
      if (ac.lat != null && ac.lon != null) {
        if (isNearHafarAlBatin(ac.lat, ac.lon)) habCount++
        if (isNearAnySite(ac.lat, ac.lon)) siteCount++
        const d = haversineDistance(ac.lat, ac.lon, 28.4328, 45.9708) / 1852
        if (d <= 250) habCount = habCount // counted above already
        if (isInSaudiAirspace(ac.lat, ac.lon)) saudiCount++
      }
    }
    console.log(
      `[PRE-MERGE] ${source}: raw=${aircraft.length} saudi_bbox=${saudiCount} ` +
      `within_100nm_HAB=${aircraft.filter(a => a.lat != null && a.lon != null && isNearHafarAlBatin(a.lat, a.lon)).length} ` +
      `within_250nm_HAB=${aircraft.filter(a => a.lat != null && a.lon != null && haversineDistance(a.lat, a.lon, 28.4328, 45.9708) <= 250*1852).length}`
    )
  }

  // ── Global Merge ──
  const merged = mergeAllProviders(rawContributions, Date.now())

  // ── Compute final diagnostics ──
  const diagnostics = computeMergeDiagnostics(merged, rawTotal, rawContributions.length)
  logMergeDiagnostics(diagnostics)

  // ── POST-MERGE INSTRUMENTATION ──
  const mergedHab100 = merged.filter(a => haversineDistance(a.latitude, a.longitude, 28.4328, 45.9708) <= 100 * 1852).length
  const mergedHab250 = merged.filter(a => haversineDistance(a.latitude, a.longitude, 28.4328, 45.9708) <= 250 * 1852).length
  const mergedSaudi = merged.filter(a => isInSaudiAirspace(a.latitude, a.longitude)).length
  console.log(`[POST-MERGE] final=${merged.length} saudi=${mergedSaudi} within_100nm_HAB=${mergedHab100} within_250nm_HAB=${mergedHab250}`)

  // ── Hafar Al Batin coverage diagnostics (POST-merge) ──
  const habDiag = computeHafrCoverage(merged)
  console.log(
    `[HAFAR AL BATIN COVERAGE] ` +
    `Center=(${28.4328},${45.9708}) ` +
    `PriorityRadius=${habDiag.priorityRadiusNm}nm ` +
    `AircraftInRadius=${habDiag.aircraftCount} ` +
    `TotalFinalAircraft=${habDiag.totalAircraft}`
  )

  // Build per-provider HAB tracking for the diagnostics return
  const habPerProviderRaw: Record<string, number> = {}
  const habPerProviderNear: Record<string, number> = {}
  for (const { source, aircraft } of rawContributions) {
    habPerProviderRaw[source] = aircraft.length
    let habCount = 0
    for (const ac of aircraft) {
      if (ac.lat != null && ac.lon != null && isNearHafarAlBatin(ac.lat, ac.lon)) {
        habCount++
      }
    }
    habPerProviderNear[source] = habCount
  }

  // ── Site coverage diagnostics (POST-merge) ──
  const siteDiags = computeSiteCoverage(merged)
  for (const sd of siteDiags) {
    console.log(
      `[LOCAL COVERAGE] Site=${sd.code} ` +
      `Center=(${sd.latitude.toFixed(4)},${sd.longitude.toFixed(4)}) ` +
      `Radius=${sd.radiusNm}nm ` +
      `AircraftInRadius=${sd.aircraftCount}`
    )
  }

  const enhancedHabDiag: import('./types').HabCoverageDiagnostics = {
    perProviderRaw: habPerProviderRaw,
    perProviderNearHab: habPerProviderNear,
    aircraftInRadius: habDiag.aircraftCount,
    totalFinal: habDiag.totalAircraft,
    priorityRadiusNm: habDiag.priorityRadiusNm,
  }

  const enhancedSiteDiags: import('./types').SiteCoverageDiagnosticsEntry[] = siteDiags.map(sd => ({
    code: sd.code,
    centerLat: sd.latitude,
    centerLon: sd.longitude,
    radiusNm: sd.radiusNm,
    aircraftCount: sd.aircraftCount,
  }))

  return { aircraft: merged, diagnostics, providerMetrics, habDiagnostics: enhancedHabDiag, siteDiagnostics: enhancedSiteDiags }
}

/**
 * Get all provider health statuses.
 */
export function getAllProviderHealth(): Record<string, ProviderHealth> {
  return {
    adsbLol: getAdsbLolHealth(),
    adsbFi: getAdsbFiHealth(),
    openSky: getOpenSkyHealth(),
    airplanesLive: getAirplanesLiveHealth(),
    intelSky: getIntelSkyHealth(),
  }
}