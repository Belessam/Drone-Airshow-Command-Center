/**
 * Diagnostics and metrics for the aircraft multi-source merge pipeline.
 *
 * Each provider fetch produces metrics; the merge pipeline produces a
 * final diagnostic report.  These are returned from fetchAllAircraft()
 * and can be displayed in a development-only CoverageDiagnostics UI.
 */

import type { Aircraft, ProviderMetrics, MergeDiagnostics, AdsbAircraft } from './types'
import { isInSaudiAirspace } from './geography'

// ─── Provider Metrics Computation ───

export function computeProviderMetrics(
  providerName: string,
  raw: AdsbAircraft[],
  allIcaosGlobalBefore: Set<string>,
  responseTimeMs: number,
  cellsQueried: number,
): ProviderMetrics {
  const localIcaos = new Set<string>()
  let militaryCount = 0

  for (const ac of raw) {
    if (!ac.hex) continue
    const id = ac.hex.toLowerCase()
    localIcaos.add(id)
    if (ac.mil === true) militaryCount++
  }

  // newUnique: ICAO24s returned by this provider that haven't been seen by any other
  let newUniqueCount = 0
  for (const id of localIcaos) {
    if (!allIcaosGlobalBefore.has(id)) newUniqueCount++
  }

  // Saudi-only count — compute from actual coordinates using the boundary check
  let saudiCount = 0
  for (const ac of raw) {
    if (ac.lat != null && ac.lon != null && isInSaudiAirspace(ac.lat, ac.lon)) {
      saudiCount++
    }
  }

  return {
    rawAircraft: raw.length,
    uniqueAircraft: localIcaos.size,
    newUniqueAircraft: newUniqueCount,
    saudiCount,
    militaryCount,
    lastUpdate: Date.now(),
    status: 'ok',
    errorCount: 0,
    avgResponseTimeMs: responseTimeMs,
    cellsQueried,
  }
}

// ─── Merge Pipeline Diagnostics ───

export function computeMergeDiagnostics(
  aircraft: Aircraft[],
  rawTotal: number,
  providerCount: number,
): MergeDiagnostics {
  const civilian = aircraft.filter(a => a.classification === 'civilian').length
  const military = aircraft.filter(a => a.classification === 'military').length
  const unknown = aircraft.filter(a => a.classification === 'unknown').length
  const multiSourceCount = aircraft.filter(a => a.sources.length >= 2).length
  const duplicatesRemoved = rawTotal - aircraft.length

  return {
    providers: providerCount,
    rawTotal,
    duplicatesRemoved: Math.max(0, duplicatesRemoved),
    finalUnique: aircraft.length,
    civilian,
    military,
    unknown,
    multiSourceCount,
  }
}

// ─── Error Provider Metrics (for rate-limit / failure scenarios) ───

export function errorProviderMetrics(
  providerName: string,
  errorCount: number,
): ProviderMetrics {
  return {
    rawAircraft: 0,
    uniqueAircraft: 0,
    newUniqueAircraft: 0,
    saudiCount: 0,
    militaryCount: 0,
    lastUpdate: null,
    status: errorCount > 3 ? 'error' : 'rate_limited',
    errorCount,
    avgResponseTimeMs: 0,
    cellsQueried: 0,
  }
}

// ─── Console Logging ───

export function logProviderMetrics(
  providerName: string,
  metrics: ProviderMetrics,
): void {
  console.log(
    `[AIRCRAFT SOURCE] provider=${providerName} ` +
    `raw=${metrics.rawAircraft} ` +
    `unique=${metrics.uniqueAircraft} ` +
    `new_unique=${metrics.newUniqueAircraft} ` +
    `saudi=${metrics.saudiCount} ` +
    `mil=${metrics.militaryCount} ` +
    `status=${metrics.status}`
  )
}

export function logMergeDiagnostics(diag: MergeDiagnostics): void {
  console.log(
    `[AIRCRAFT MERGE] providers=${diag.providers} ` +
    `raw_total=${diag.rawTotal} ` +
    `dups_removed=${diag.duplicatesRemoved} ` +
    `final_unique=${diag.finalUnique} ` +
    `civilian=${diag.civilian} ` +
    `military=${diag.military} ` +
    `unknown=${diag.unknown} ` +
    `multi_source=${diag.multiSourceCount}`
  )
}