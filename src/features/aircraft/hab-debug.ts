/**
 * HAFAR AL BATIN COVERAGE DEBUG
 *
 * Runtime diagnostic that directly tests each provider for the exact HAB coordinates.
 * Prints exhaustive logs to the browser console.
 * Can be triggered via window.__habDebug() from the browser console.
 */
import { getAllRadiusGridCells, HAFAR_AL_BATIN, SAUDI_BBOX, SAUDI_BBOX_EXTENDED, isInSaudiAirspace, isNearHafarAlBatin, isNearAnySite, shouldIncludeAircraft, haversineDistance, getSiteLocations } from './geography'
import { fetchAdsbLol } from './providers/adsb-lol'
import { fetchAdsbFi } from './providers/adsb-fi'
import { fetchOpenSky } from './providers/open-sky'
import { fetchAirplanesLive } from './providers/airplanes-live'
import type { AdsbAircraft } from './types'

const HAB_LAT = 28.4328
const HAB_LON = 45.9708
const HAB_LABEL = 'Hafar Al Batin'

function nmToM(nm: number): number { return nm * 1852 }

export async function runHabDebug() {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║        HAFAR AL BATIN COVERAGE DEBUG v1                    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  // ── PHASE 1: Coordinate Verification ──
  console.log('')
  console.log('[PHASE 1] COORDINATE VERIFICATION')
  console.log(`  Hafar Al Batin center: lat=${HAB_LAT}, lon=${HAB_LON}`)
  console.log(`  Expected: lat=28.4328, lon=45.9708`)
  console.log(`  Lat match: ${HAB_LAT === 28.4328}`)
  console.log(`  Lon match: ${HAB_LON === 45.9708}`)
  console.log(`  Signs: lat positive=${HAB_LAT > 0} (EXPECTED), lon positive=${HAB_LON > 0} (EXPECTED)`)

  // Reality check: what city is this?
  console.log('')
  console.log('[PHASE 1b] REAL SITE COORDINATES')
  const sites = getSiteLocations()
  console.log(`  Total sites loaded: ${sites.length}`)
  for (const site of sites) {
    const habDistNm = haversineDistance(site.latitude, site.longitude, HAB_LAT, HAB_LON) / 1852
    console.log(`  Site ${site.code}: lat=${site.latitude}, lon=${site.longitude} | Dist from HAB: ${habDistNm.toFixed(1)}nm`)
  }
  if (sites.length === 0) {
    console.log('  WARNING: No sites loaded! setSiteLocations() may not have been called yet.')
  }

  // ── PHASE 3: Query Geometry ──
  console.log('')
  console.log('[PHASE 3] QUERY GEOMETRY')
  const gridCells = getAllRadiusGridCells()
  console.log(`  Total grid cells: ${gridCells.length}`)
  for (const cell of gridCells) {
    const habDistNm = haversineDistance(cell.latitude, cell.longitude, HAB_LAT, HAB_LON) / 1852
    const coversHAB = habDistNm <= cell.radiusNm
    console.log(`  Cell ${cell.id}: center=(${cell.latitude},${cell.longitude}) radius=${cell.radiusNm}nm | HAB dist=${habDistNm.toFixed(1)}nm | COVERS_HAB=${coversHAB}`)
  }

  console.log('')
  console.log(`  Saudi BBOX: lat [${SAUDI_BBOX.minLat}, ${SAUDI_BBOX.maxLat}] lon [${SAUDI_BBOX.minLon}, ${SAUDI_BBOX.maxLon}]`)
  console.log(`  Extended BBOX: lat [${SAUDI_BBOX_EXTENDED.minLat}, ${SAUDI_BBOX_EXTENDED.maxLat}] lon [${SAUDI_BBOX_EXTENDED.minLon}, ${SAUDI_BBOX_EXTENDED.maxLon}]`)
  console.log(`  HAB in SA bbox: ${isInSaudiAirspace(HAB_LAT, HAB_LON)}`)
  console.log(`  HAB in extended bbox: ${isInSaudiAirspace(HAB_LAT, HAB_LON)} (same check)`)
  const extCheck = HAB_LAT >= SAUDI_BBOX_EXTENDED.minLat && HAB_LAT <= SAUDI_BBOX_EXTENDED.maxLat &&
    HAB_LON >= SAUDI_BBOX_EXTENDED.minLon && HAB_LON <= SAUDI_BBOX_EXTENDED.maxLon
  console.log(`  HAB in extended bbox (explicit): ${extCheck}`)

  // ── PROVIDER TESTS ──
  console.log('')
  console.log('[PHASE 2/4] INDIVIDUAL PROVIDER TESTS FOR HAB')
  console.log('')

  // Test each provider's raw HAB cell query
  await testProviderForHAB('ADSB.lol (HAB cell)', async () => {
    const habCell = gridCells.find(c => c.id === 'hab')
    if (!habCell) return []
    const { fetchAdsbLol: fetchAdsbLolInner } = await import('./providers/adsb-lol')
    // Direct fetch using fetchJson for just the HAB cell
    const { fetchJson } = await import('./providers/fetch-json')
    const data = await fetchJson(`/api/adsb/v2/lat/${HAB_LAT}/lon/${HAB_LON}/dist/250`, 'habDebug-adsbLol')
    if (data?.ac) return data.ac as AdsbAircraft[]
    return []
  })

  await testProviderForHAB('ADSB.lol (NC cell — covers HAB at edge)', async () => {
    const { fetchJson } = await import('./providers/fetch-json')
    const data = await fetchJson(`/api/adsb/v2/lat/28.0/lon/44.5/dist/250`, 'habDebug-adsbLol-nc')
    if (data?.ac) return data.ac as AdsbAircraft[]
    return []
  })

  await testProviderForHAB('adsb.fi (HAB cell)', async () => {
    const { fetchJson } = await import('./providers/fetch-json')
    const data = await fetchJson(`/api/adsbfi/v3/lat/${HAB_LAT}/lon/${HAB_LON}/dist/250`, 'habDebug-adsbFi')
    if (data?.ac) return data.ac as AdsbAircraft[]
    return []
  })

  await testProviderForHAB('OpenSky (full SA bbox)', async () => {
    const { fetchJson } = await import('./providers/fetch-json')
    const params = `lamin=${SAUDI_BBOX_EXTENDED.minLat}&lomin=${SAUDI_BBOX_EXTENDED.minLon}&lamax=${SAUDI_BBOX_EXTENDED.maxLat}&lomax=${SAUDI_BBOX_EXTENDED.maxLon}`
    console.log(`  OpenSky direct URL params: ${params}`)
    const data = await fetchJson(`/api/opensky/states/all?${params}`, 'habDebug-openSky')
    if (data?.states) {
      return data.states
        .map((s: any[]) => ({
          hex: s[0] as string,
          lat: s[6] as number | null,
          lon: s[5] as number | null,
          flight: s[1] as string | undefined,
          gs: s[9] as number | undefined,
          track: s[10] as number | undefined,
          alt_baro: s[7] as number | undefined,
          baro_rate: s[11] as number | undefined,
        }))
        .filter((ac: any) => ac.lat != null && ac.lon != null) as AdsbAircraft[]
    }
    return []
  })

  // ── BOUNDARY FILTER TESTS ──
  console.log('')
  console.log('[PHASE 6] SAUDI BOUNDARY FILTER TESTS')
  console.log(`  HAB center (${HAB_LAT}, ${HAB_LON}):`)
  console.log(`    isInSaudiAirspace: ${isInSaudiAirspace(HAB_LAT, HAB_LON)}`)
  console.log(`    isNearHafarAlBatin: ${isNearHafarAlBatin(HAB_LAT, HAB_LON)}`)
  console.log(`    isNearAnySite: ${isNearAnySite(HAB_LAT, HAB_LON)}`)
  console.log(`    shouldIncludeAircraft: ${shouldIncludeAircraft(HAB_LAT, HAB_LON)}`)

  // Test a ring of points around HAB at various distances
  console.log('')
  console.log('  Boundary test ring:')
  for (const distNm of [5, 10, 25, 50, 100, 150, 200]) {
    // Test 8 cardinal points at each distance
    for (const bearing of [0, 90, 180, 270]) {
      const pt = destinationPoint(HAB_LAT, HAB_LON, bearing, distNm * 1852)
      const inclusion = shouldIncludeAircraft(pt.lat, pt.lon)
      if (!inclusion && distNm <= 100) {
        console.log(`    FAIL: point at ${distNm}nm/${bearing}° (${pt.lat.toFixed(4)},${pt.lon.toFixed(4)}) EXCLUDED`)
      }
    }
  }
  console.log('  (No FAIL messages = all boundary checks pass)')

  // ── FINAL SUMMARY ──
  console.log('')
  console.log('[HAB DEBUG] Complete')
  console.log('')

  return 'HAB debug complete — see console for full output'
}

async function testProviderForHAB(
  label: string,
  fetchFn: () => Promise<AdsbAircraft[]>,
): Promise<void> {
  console.log(`--- Provider Test: ${label} ---`)
  try {
    const aircraft = await fetchFn()
    console.log(`  Raw aircraft count: ${aircraft.length}`)

    if (aircraft.length === 0) {
      console.log('  NO AIRCRAFT RETURNED')
      return
    }

    // Count by distance from HAB
    const habDistances = aircraft
      .map(ac => ({
        ...ac,
        distNm: ac.lat != null && ac.lon != null
          ? haversineDistance(ac.lat, ac.lon, HAB_LAT, HAB_LON) / 1852
          : Infinity
      }))
      .sort((a, b) => a.distNm - b.distNm)

    const within10 = habDistances.filter(a => a.distNm <= 10)
    const within25 = habDistances.filter(a => a.distNm <= 25)
    const within50 = habDistances.filter(a => a.distNm <= 50)
    const within100 = habDistances.filter(a => a.distNm <= 100)

    console.log(`  Within 10nm of HAB: ${within10.length}`)
    console.log(`  Within 25nm of HAB: ${within25.length}`)
    console.log(`  Within 50nm of HAB: ${within50.length}`)
    console.log(`  Within 100nm of HAB: ${within100.length}`)

    if (habDistances.length > 0) {
      const nearest = habDistances[0]
      console.log(`  Nearest aircraft: ${nearest.distNm.toFixed(2)}nm at (${nearest.lat},${nearest.lon}) hex=${nearest.hex}`)
      console.log(`  Nearest 5 aircraft:`)
      for (let i = 0; i < Math.min(5, habDistances.length); i++) {
        const a = habDistances[i]
        console.log(`    ${i + 1}. hex=${a.hex} flight=${a.flight ?? '?'} dist=${a.distNm.toFixed(2)}nm pos=(${a.lat},${a.lon})`)
      }
    }

    // Check if aircraft near HAB would pass the geographic filter
    for (const ac of habDistances.slice(0, 5)) {
      if (ac.lat != null && ac.lon != null) {
        const wouldInclude = shouldIncludeAircraft(ac.lat, ac.lon)
        console.log(`    GIS check: ${ac.hex} at ${ac.distNm.toFixed(2)}nm: wouldInclude=${wouldInclude} (isInSaudi=${isInSaudiAirspace(ac.lat, ac.lon)} isNearHAB=${isNearHafarAlBatin(ac.lat, ac.lon)} isNearSite=${isNearAnySite(ac.lat, ac.lon)})`)
      }
    }
  } catch (err) {
    console.error(`  ERROR: ${err}`)
  }
  console.log('')
}

function destinationPoint(lat: number, lon: number, bearing: number, distanceM: number): { lat: number; lon: number } {
  const R = 6371000
  const toRad = (d: number) => d * Math.PI / 180
  const toDeg = (r: number) => r * 180 / Math.PI
  const latRad = toRad(lat)
  const lonRad = toRad(lon)
  const bearingRad = toRad(bearing)
  const distRatio = distanceM / R
  const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distRatio) + Math.cos(latRad) * Math.sin(distRatio) * Math.cos(bearingRad))
  const newLonRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distRatio) * Math.cos(latRad), Math.cos(distRatio) - Math.sin(latRad) * Math.sin(newLatRad))
  return { lat: toDeg(newLatRad), lon: toDeg(newLonRad) }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).__habDebug = runHabDebug
  console.log('[HAB DEBUG] Run window.__habDebug() to test providers for Hafar Al Batin')
}
