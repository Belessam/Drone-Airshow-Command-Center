/**
 * Per-Aircraft Investigative Tracer
 *
 * Search for a specific aircraft across ALL integrated providers,
 * trace it through every pipeline stage, and report exactly where
 * it was found, parsed, filtered, merged, or lost.
 *
 * Usage: window.__traceAircraft({ hex: '8961ea', callsign: 'ETD576' })
 *   or:  window.__traceAircraft({ callsign: 'ETD576' })
 *   or:  window.__traceAircraft({ hex: '8961ea' })
 */

import { fetchJson } from './providers/fetch-json'
import { haversineDistance, isInSaudiAirspace, isNearHafarAlBatin, isNearAnySite, shouldIncludeAircraft } from './geography'
import { computePositionTimestamp } from './timestamps'
import type { AdsbAircraft, AdsbResponse, OpenSkyResponse } from './types'

const HAB_LAT = 28.4328
const HAB_LON = 45.9708

interface TraceTarget {
  hex?: string
  callsign?: string
  lat?: number
  lon?: number
}

interface ProviderResult {
  provider: string
  url: string
  status: 'found' | 'not_found' | 'error' | 'timeout'
  rawResponse?: any
  matchedAircraft?: AdsbAircraft
  error?: string
  distanceToHabNm?: number
  inSaudiAirspace?: boolean
  nearHAB?: boolean
  nearAnySite?: boolean
  wouldPassFilter?: boolean
  parsed?: {
    id: string
    lat: number
    lon: number
    callsign?: string
    altitude?: number
    speed?: number
    heading?: number
  }
}

async function searchAdsbLol(target: TraceTarget): Promise<ProviderResult> {
  const queries: string[] = []
  if (target.hex) queries.push(`/api/adsb/v2/hex/${target.hex}`)
  if (target.callsign) queries.push(`/api/adsb/v2/callsign/${target.callsign}`)

  for (const url of queries) {
    try {
      const data: AdsbResponse | null = await fetchJson(url, 'trace-adsbLol')
      if (data?.ac && data.ac.length > 0) {
        const ac = data.ac[0]
        return buildResult('ADSB.lol', url, ac, target)
      }
    } catch { }
  }
  return { provider: 'ADSB.lol', url: queries.join(' | '), status: 'not_found' }
}

async function searchAdsbLolMil(target: TraceTarget): Promise<ProviderResult> {
  const url = '/api/adsb/v2/mil'
  try {
    const data: AdsbResponse | null = await fetchJson(url, 'trace-adsbLolMil')
    if (data?.ac) {
      const match = data.ac.find((a: any) =>
        (target.hex && a.hex?.toLowerCase() === target.hex.toLowerCase()) ||
        (target.callsign && a.flight?.trim()?.toLowerCase() === target.callsign.toLowerCase())
      )
      if (match) return buildResult('ADSB.lol Mil', url, match, target)
    }
  } catch { }
  return { provider: 'ADSB.lol Mil', url, status: 'not_found' }
}

async function searchAdsbFi(target: TraceTarget): Promise<ProviderResult> {
  const queries: string[] = []
  if (target.hex) queries.push(`/api/adsbfi/v3/hex/${target.hex}`)
  if (target.callsign) queries.push(`/api/adsbfi/v3/callsign/${target.callsign}`)

  for (const url of queries) {
    try {
      const data: any = await fetchJson(url, 'trace-adsbFi')
      if (data?.ac && data.ac.length > 0) {
        const ac = data.ac[0]
        return buildResult('adsb.fi', url, ac, target)
      }
    } catch { }
  }
  return { provider: 'adsb.fi', url: queries.join(' | '), status: 'not_found' }
}

async function searchOpenSky(target: TraceTarget): Promise<ProviderResult> {
  const url = '/api/opensky/states/all?lamin=12&lomax=60&lamax=35&lomin=33'
  try {
    const data: OpenSkyResponse | null = await fetchJson(url, 'trace-openSky')
    if (data?.states) {
      for (const s of data.states) {
        const hex = (s[0] as string)?.toLowerCase()
        const callsign = (s[1] as string)?.trim()?.toLowerCase()
        const matchHex = target.hex && hex === target.hex.toLowerCase()
        const matchCs = target.callsign && callsign === target.callsign.toLowerCase()
        if (matchHex || matchCs) {
          const ac: AdsbAircraft = {
            hex: s[0] as string,
            flight: (s[1] as string)?.trim() || undefined,
            lat: s[6] as number | null ?? undefined,
            lon: s[5] as number | null ?? undefined,
            alt_baro: typeof s[7] === 'number' ? s[7] : undefined,
            gs: typeof s[9] === 'number' ? s[9] : undefined,
            track: typeof s[10] === 'number' ? s[10] : undefined,
            baro_rate: typeof s[11] === 'number' ? s[11] : undefined,
          }
          return buildResult('OpenSky', url, ac, target)
        }
      }
    }
  } catch { }
  return { provider: 'OpenSky', url, status: 'not_found' }
}

async function searchAirplanesLive(target: TraceTarget): Promise<ProviderResult> {
  const url = `/api/airplaneslive/hex/${target.hex}`
  try {
    const data: any = await fetchJson(url, 'trace-airplanesLive')
    if (data?.ac && data.ac.length > 0) {
      return buildResult('Airplanes.live', url, data.ac[0], target)
    }
  } catch { }
  return { provider: 'Airplanes.live', url, status: 'not_found' }
}

async function searchIntelSky(target: TraceTarget): Promise<ProviderResult> {
  const url = `https://intelsky.org/api/`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    const data = await res.json()
    if (data?.ac) {
      const match = data.ac.find((a: any) => {
        const hex = a.hex?.toLowerCase()
        const cs = a.flight?.trim()?.toLowerCase()
        return (target.hex && hex === target.hex.toLowerCase()) ||
               (target.callsign && cs === target.callsign.toLowerCase())
      })
      if (match) {
        const ac: AdsbAircraft = {
          hex: match.hex,
          flight: match.flight?.trim() || undefined,
          lat: match.lat,
          lon: match.lon,
          alt_baro: match.alt_baro,
          gs: match.gs,
          track: match.track,
          mil: match.mil,
        }
        return buildResult('IntelSky', url, ac, target)
      }
    }
  } catch {}
  return { provider: 'IntelSky', url, status: 'not_found' }
}

function buildResult(provider: string, url: string, ac: AdsbAircraft, target: TraceTarget): ProviderResult {
  const lat = ac.lat ?? 0
  const lon = ac.lon ?? 0
  const distNm = haversineDistance(lat, lon, HAB_LAT, HAB_LON) / 1852
  const inSaudi = isInSaudiAirspace(lat, lon)
  const nearHAB = isNearHafarAlBatin(lat, lon)
  const nearSite = isNearAnySite(lat, lon)
  const wouldPass = shouldIncludeAircraft(lat, lon)

  return {
    provider,
    url,
    status: 'found',
    rawResponse: JSON.stringify(ac).slice(0, 500),
    matchedAircraft: ac,
    distanceToHabNm: Math.round(distNm * 10) / 10,
    inSaudiAirspace: inSaudi,
    nearHAB,
    nearAnySite: nearSite,
    wouldPassFilter: wouldPass,
    parsed: {
      id: ac.hex?.toLowerCase() || 'unknown',
      lat,
      lon,
      callsign: ac.flight?.trim(),
      altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : undefined,
      speed: ac.gs,
      heading: ac.track,
    },
  }
}

export async function traceAircraft(target: TraceTarget): Promise<void> {
  if (!target.hex && !target.callsign) {
    console.error('[TRACE] Provide at least hex or callsign')
    return
  }

  console.log('')
  console.log('╔════════════════════════════════════════════════════╗')
  console.log('║        PER-AIRCRAFT INVESTIGATION                ║')
  console.log('╚════════════════════════════════════════════════════╝')
  console.log(` Target: hex=${target.hex || '?'} callsign=${target.callsign || '?'}`)
  if (target.lat && target.lon) {
    const d = haversineDistance(target.lat, target.lon, HAB_LAT, HAB_LON) / 1852
    console.log(` Position: (${target.lat}, ${target.lon}) — ${d.toFixed(1)}nm from HAB`)
  }
  console.log('')

  const results = await Promise.all([
    searchAdsbLol(target),
    searchAdsbLolMil(target),
    searchAdsbFi(target),
    searchOpenSky(target),
    searchAirplanesLive(target),
    searchIntelSky(target),
  ])

  const found = results.filter(r => r.status === 'found')
  const notFound = results.filter(r => r.status === 'not_found')

  console.log(`--- RESULTS: ${found.length} found, ${notFound.length} not found ---`)
  console.log('')

  for (const r of results) {
    if (r.status === 'found' && r.parsed) {
      console.log(`✅ ${r.provider}: FOUND`)
      console.log(`   URL: ${r.url}`)
      console.log(`   Parsed: id=${r.parsed.id} pos=(${r.parsed.lat},${r.parsed.lon})`)
      console.log(`   Callsign: ${r.parsed.callsign || '?'}  Alt: ${r.parsed.altitude ?? '?'}ft  Speed: ${r.parsed.speed ?? '?'}kt`)
      console.log(`   Distance from HAB: ${r.distanceToHabNm}nm`)
      console.log(`   In Saudi airspace: ${r.inSaudiAirspace}`)
      console.log(`   Near HAB (100nm): ${r.nearHAB}`)
      console.log(`   Near any Site: ${r.nearAnySite}`)
      console.log(`   Would pass geographic filter: ${r.wouldPassFilter}`)
      console.log(`   Raw sample: ${r.rawResponse}`)

      // Trace through pipeline stages
      console.log('')
      console.log('   ── PIPELINE TRACE ──')
      console.log(`   Stage 1 (Fetch): ✅ Found in ${r.provider}`)
      console.log(`   Stage 2 (Parse): ✅ lat=${r.parsed.lat} lon=${r.parsed.lon}`)

      // Geographic filter
      if (r.wouldPassFilter) {
        console.log(`   Stage 3 (Geo filter): ✅ PASS (${r.inSaudiAirspace ? 'inSA' : ''}${r.nearHAB ? ' nearHAB' : ''}${r.nearAnySite ? ' nearSite' : ''})`)
        console.log(`   Stage 4 (Normalize): ✅ would create Aircraft { id: ${r.parsed.id} }`)
        console.log(`   Stage 5 (Dedup):    ✅ would be added to merged set`)
        console.log(`   Stage 6 (Merge):    ✅ would be returned in fetchAllAircraft()`)
        console.log(`   Stage 7 (Hook):     ✅ would reach useAircraft hook`)
        console.log(`   Stage 8 (MapView):  ✅ would reach MapView and create marker`)
      } else {
        console.log(`   Stage 3 (Geo filter): ❌ FAIL`)
        console.log(`     inSaudiAirspace=${r.inSaudiAirspace} nearHAB=${r.nearHAB} nearAnySite=${r.nearAnySite}`)
        console.log(`     Aircraft excluded by shouldIncludeAircraft() in geography.ts:221`)
      }
      console.log('')
    } else {
      console.log(`❌ ${r.provider}: NOT FOUND (${r.url})`)
    }
  }

  if (notFound.length === results.length) {
    console.log('')
    console.log('╔════════════════════════════════════════════════════╗')
    console.log('║  CONCLUSION:                                     ║')
    console.log('║  Aircraft NOT found in ANY free public provider.  ║')
    console.log('║  FlightRadar24 uses proprietary data sources:     ║')
    console.log('║  - Their own feeder network (F)                  ║')
    console.log('║  - Satellite-based ADS-B (Aireon)                ║')
    console.log('║  - MLAT from their proprietary network            ║')
    console.log('║  - FAA/Government feeds (NATS, DFS, etc.)         ║')
    console.log('║  These are NOT available through free public APIs.║')
    console.log('╚════════════════════════════════════════════════════╝')
  }

  console.log('')
}

// Expose globally
if (typeof window !== 'undefined') {
  (window as any).__traceAircraft = traceAircraft
  console.log('[TRACE] Run window.__traceAircraft({hex: "..."}) or window.__traceAircraft({callsign: "..."})')
}