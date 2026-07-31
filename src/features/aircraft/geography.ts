/**
 * Saudi Arabia geographic coverage — bounding box, grid cells, and boundary checks.
 *
 * Coverage model (OR-based inclusion):
 *   Aircraft is included if ANY of these are true:
 *   (A) Inside the Saudi Arabia bounding box
 *   (B) Inside the local radius of ANY configured Site
 *   (C) Inside the Hafar Al Batin priority radius
 *
 * For radius-limited APIs (max 250nm ≈ 463km radius):
 *   Base grid: 6 cells covering Saudi Arabia
 *   + 1 dedicated Hafar Al Batin cell (ensures coverage there)
 *   + N Site-proximity cells (one per configured Site)
 *
 * For bounding-box-capable APIs:
 *   Extended bounding box that includes surrounding airspace
 *   + Site-centered queries where needed
 *
 * Hafar Al Batin: 28.4328°N, 45.9708°E
 */

import type { GridCell, BoundingBox } from './types'

// ─── Saudi Arabia Bounding Box ───

export const SAUDI_BBOX: BoundingBox = {
  minLat: 14.0,
  maxLat: 33.5,
  minLon: 34.0,
  maxLon: 57.0,
} as const

/**
 * Extended bounding box for bounding-box-capable APIs (OpenSky).
 * Includes surrounding airspace — Red Sea, Persian Gulf, Gulf of Aqaba,
 * and the eastern Mediterranean approach.
 */
export const SAUDI_BBOX_EXTENDED: BoundingBox = {
  minLat: 12.0,
  maxLat: 35.0,
  minLon: 33.0,
  maxLon: 60.0,
} as const

// ─── Hafar Al Batin Priority Area ───

export const HAFAR_AL_BATIN = {
  latitude: 28.4328,
  longitude: 45.9708,
  label: 'Hafar Al Batin',
  /** Local priority radius in nautical miles — 200nm to capture Dammam/Kuwait Gulf corridor traffic */
  priorityRadiusNm: 200,
} as const

// ─── Site Coverage Radius ───

/** Default radius around each configured Site in nautical miles */
export const SITE_COVERAGE_RADIUS_NM = 100

// ─── Configurable Site List (updated at runtime from app data) ───

/**
 * Site locations for coverage queries.
 * This is populated by setSiteLocations() from the actual app sites.
 */
let siteLocations: { id: string; code: string; latitude: number; longitude: number }[] = []

/**
 * Populate the site locations used for coverage queries.
 * Called by the app at initialization with actual Site data.
 */
export function setSiteLocations(
  sites: { id: string; code: string; latitude: number; longitude: number }[],
): void {
  siteLocations = sites.filter(s =>
    typeof s.latitude === 'number' &&
    typeof s.longitude === 'number' &&
    isFinite(s.latitude) &&
    isFinite(s.longitude)
  )
  console.log(`[GEOGRAPHY] Loaded ${siteLocations.length} sites for coverage queries`)
}

export function getSiteLocations() {
  return [...siteLocations]
}

// ─── Radius-Limited Grid Cells (250nm) ───

/**
 * Base grid: 8 cells covering Saudi Arabia + Persian Gulf for radius-limited providers.
 * Each cell has a 250nm radius (~463km), with center-to-center spacing
 * that provides ~50-200km overlap between adjacent cells.
 *
 * Row 1 (North): Tabuk/NEOM → Hail/Qassim → Dammam/Eastern
 * Row 2 (Central): Red Sea → Riyadh → Persian Gulf
 * Row 3 (South): Jeddah/Mecca → Abha/Asir → Najran/Sharurah
 *
 * The two Persian Gulf cells (pg-north, pg-south) capture heavy air traffic
 * over the Gulf corridor that would otherwise fall outside the Saudi land bbox.
 */
export const SAUDI_GRID_CELLS: GridCell[] = [
  { id: 'nw', latitude: 28.0, longitude: 37.5, radiusNm: 250, label: 'North-West (Tabuk/NEOM)' },
  { id: 'nc', latitude: 28.0, longitude: 44.5, radiusNm: 250, label: 'North-Central (Hail/Qassim)' },
  { id: 'ne', latitude: 28.0, longitude: 51.5, radiusNm: 250, label: 'North-East (Dammam/Eastern)' },
  { id: 'cm', latitude: 24.0, longitude: 44.5, radiusNm: 250, label: 'Central (Riyadh)' },
  { id: 'pg', latitude: 26.5, longitude: 51.0, radiusNm: 250, label: 'Persian Gulf Corridor' },
  { id: 'sw', latitude: 20.0, longitude: 37.5, radiusNm: 250, label: 'South-West (Jeddah/Mecca)' },
  { id: 'sc', latitude: 20.0, longitude: 44.5, radiusNm: 250, label: 'South-Central (Abha/Asir)' },
  { id: 'se', latitude: 20.0, longitude: 51.5, radiusNm: 250, label: 'South-East (Najran/Sharurah)' },
] as const

/**
 * Dedicated Hafar Al Batin grid cell — ensures the area is explicitly
 * queried rather than relying on edge coverage from adjacent cells.
 */
function hafarAlBatinCell(): GridCell {
  return {
    id: 'hab',
    latitude: HAFAR_AL_BATIN.latitude,
    longitude: HAFAR_AL_BATIN.longitude,
    radiusNm: 250,
    label: 'Hafar Al Batin',
  }
}

/**
 * Build site-proximity grid cells from the configured site locations.
 * Each cell is centered on the site with a 250nm query radius.
 */
function siteCells(): GridCell[] {
  return siteLocations.map((site, i) => ({
    id: `site-${i}`,
    latitude: site.latitude,
    longitude: site.longitude,
    radiusNm: 250,
    label: `${site.code} (${site.code})`,
  }))
}

/**
 * Complete set of grid cells for a radius-limited provider query.
 * Includes: SA base cells + Hafar Al Batin cell + Site-proximity cells.
 */
export function getAllRadiusGridCells(): GridCell[] {
  const cells = [...SAUDI_GRID_CELLS, hafarAlBatinCell()]
  cells.push(...siteCells())
  return cells
}

/**
 * Get grid cells for a provider — includes base cells + HAB cell.
 */
export function getRadiusGridCells(): GridCell[] {
  return [...SAUDI_GRID_CELLS, hafarAlBatinCell()]
}

// ─── Bounding Box for OpenSky ───

export function openSkyBboxParams(): string {
  return [
    `lamin=${SAUDI_BBOX_EXTENDED.minLat}`,
    `lomax=${SAUDI_BBOX_EXTENDED.maxLon}`,
    `lamax=${SAUDI_BBOX_EXTENDED.maxLat}`,
    `lomin=${SAUDI_BBOX_EXTENDED.minLon}`,
  ].join('&')
}

// ─── Boundary Checks (OR-based inclusion) ───

/**
 * Check whether a point falls within the Saudi Arabian bounding box.
 */
export function isInSaudiAirspace(lat: number, lon: number): boolean {
  return (
    lat >= SAUDI_BBOX.minLat &&
    lat <= SAUDI_BBOX.maxLat &&
    lon >= SAUDI_BBOX.minLon &&
    lon <= SAUDI_BBOX.maxLon
  )
}

/**
 * Check whether a point falls within the extended Saudi airspace.
 */
export function isInExtendedAirspace(lat: number, lon: number): boolean {
  return (
    lat >= SAUDI_BBOX_EXTENDED.minLat &&
    lat <= SAUDI_BBOX_EXTENDED.maxLat &&
    lon >= SAUDI_BBOX_EXTENDED.minLon &&
    lon <= SAUDI_BBOX_EXTENDED.maxLon
  )
}

/**
 * Check whether a point is within the Hafar Al Batin priority radius.
 */
export function isNearHafarAlBatin(lat: number, lon: number): boolean {
  return haversineDistance(lat, lon, HAFAR_AL_BATIN.latitude, HAFAR_AL_BATIN.longitude)
    <= HAFAR_AL_BATIN.priorityRadiusNm * 1852
}

/**
 * Check whether a point is within the local coverage radius of ANY configured Site.
 */
export function isNearAnySite(lat: number, lon: number): boolean {
  const radiusM = SITE_COVERAGE_RADIUS_NM * 1852
  for (const site of siteLocations) {
    if (haversineDistance(lat, lon, site.latitude, site.longitude) <= radiusM) {
      return true
    }
  }
  return false
}

/**
 * Final geographic inclusion check — OR-based.
 *
 * An aircraft is included if ANY of these is true:
 *   - Inside Saudi Arabia airspace
 *   - Inside Hafar Al Batin priority radius
 *   - Inside local coverage radius of any configured Site
 *
 * This replaces the old single-filter isInSaudiAirspace() approach.
 */
export function shouldIncludeAircraft(lat: number, lon: number): boolean {
  return isInSaudiAirspace(lat, lon) || isNearHafarAlBatin(lat, lon) || isNearAnySite(lat, lon)
}

// ─── Site Diagnostics ───

export interface SiteCoverageInfo {
  code: string
  latitude: number
  longitude: number
  radiusNm: number
  aircraftCount: number
}

/**
 * Count how many aircraft are near each site (for diagnostics).
 */
export function computeSiteCoverage(aircraft: { latitude: number; longitude: number }[]): SiteCoverageInfo[] {
  const radiusM = SITE_COVERAGE_RADIUS_NM * 1852
  return siteLocations.map(site => {
    let count = 0
    for (const ac of aircraft) {
      if (haversineDistance(ac.latitude, ac.longitude, site.latitude, site.longitude) <= radiusM) {
        count++
      }
    }
    return {
      code: site.code,
      latitude: site.latitude,
      longitude: site.longitude,
      radiusNm: SITE_COVERAGE_RADIUS_NM,
      aircraftCount: count,
    }
  })
}

/**
 * Compute HAB diagnostics.
 */
export function computeHafrCoverage(aircraft: { latitude: number; longitude: number }[]): {
  priorityRadiusNm: number
  aircraftCount: number
  totalAircraft: number
} {
  const radiusM = HAFAR_AL_BATIN.priorityRadiusNm * 1852
  let count = 0
  for (const ac of aircraft) {
    if (haversineDistance(ac.latitude, ac.longitude, HAFAR_AL_BATIN.latitude, HAFAR_AL_BATIN.longitude) <= radiusM) {
      count++
    }
  }
  return {
    priorityRadiusNm: HAFAR_AL_BATIN.priorityRadiusNm,
    aircraftCount: count,
    totalAircraft: aircraft.length,
  }
}

// ─── Utility ───

export function getFullBbox(): BoundingBox {
  return { ...SAUDI_BBOX }
}

export function getExtendedBbox(): BoundingBox {
  return { ...SAUDI_BBOX_EXTENDED }
}

/**
 * Calculate the haversine distance between two points in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}