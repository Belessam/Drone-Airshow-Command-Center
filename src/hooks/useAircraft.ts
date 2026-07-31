/**
 * useAircraft — React hook that polls all ADS-B providers for live aircraft.
 *
 * - Polls all enabled providers on a regular interval
 * - On rate-limit (420/429), preserves last known data
 * - Exposes per-provider metrics and merge diagnostics
 * - Stale aircraft removed after AIRCRAFT_CONFIG.staleThresholdMs
 * - Dead-reckoning: smoothly extrapolates aircraft positions between API polls
 *   using last CONFIRMED position, speed, heading, and timestamp.
 *   CRITICAL: extrapolation is always recomputed from the confirmed position,
 *   never from a previously extrapolated position. No compounding.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchAllAircraft } from '@/features/aircraft/aircraftService'
import { AIRCRAFT_CONFIG } from '@/features/aircraft/config'
import { extrapolatePosition } from '@/features/aircraft/dead-reckoning'
import { setSiteLocations, haversineDistance } from '@/features/aircraft/geography'
import type { Aircraft, ProviderMetrics, MergeDiagnostics, HabCoverageDiagnostics, SiteCoverageDiagnosticsEntry } from '@/features/aircraft/types'

const INTERPOLATION_INTERVAL_MS = 1000 // 1 second updates

interface UseAircraftReturn {
  aircraft: Aircraft[]
  showAircraft: boolean
  toggleAircraft: () => void
  loading: boolean
  diagnostics: MergeDiagnostics | null
  providerMetrics: Record<string, ProviderMetrics>
  habDiagnostics: HabCoverageDiagnostics | null
  siteDiagnostics: SiteCoverageDiagnosticsEntry[]
}

export function useAircraft(): UseAircraftReturn {
  const [aircraft, setAircraft] = useState<Aircraft[]>([])
  const [showAircraft, setShowAircraft] = useState(true)
  const [loading, setLoading] = useState(false)
  const [diagnostics, setDiagnostics] = useState<MergeDiagnostics | null>(null)
  const [providerMetrics, setProviderMetrics] = useState<Record<string, ProviderMetrics>>({})
  const [habDiagnostics, setHabDiagnostics] = useState<HabCoverageDiagnostics | null>(null)
  const [siteDiagnostics, setSiteDiagnostics] = useState<SiteCoverageDiagnosticsEntry[]>([])

  /**
   * The authoritative source of truth — last CONFIRMED API data for each aircraft.
   * These objects are NEVER mutated after being stored.
   * Extrapolation reads from here; API fetches replace entries here.
   */
  const confirmedMap = useRef<Map<string, Aircraft>>(new Map())

  const mountedRef = useRef(true)
  const fetchIdRef = useRef(0)

  const fetchAndMerge = useCallback(async () => {
    const fetchId = ++fetchIdRef.current
    setLoading(true)

    const result = await fetchAllAircraft()

    // Ignore stale responses if a newer fetch already started
    if (fetchId !== fetchIdRef.current) return

    const { aircraft: fetched, diagnostics: diag, providerMetrics: metrics, habDiagnostics: habDiag, siteDiagnostics: siteDiag } = result
    const now = Date.now()
    const map = confirmedMap.current
    const staleThreshold = AIRCRAFT_CONFIG.staleThresholdMs

    // Update diagnostics
    setDiagnostics(diag)
    setProviderMetrics(prev => ({ ...prev, ...metrics }))
    setHabDiagnostics(habDiag)
    setSiteDiagnostics(siteDiag)

    const tick = ++tickRef.current

    // Only update the map if we got new data (preserve old data on rate-limit)
    if (fetched.length > 0) {
      for (const ac of fetched) {
        const existing = map.get(ac.id)
        if (existing) {
          // Keep the entry with the freshest position timestamp
          if (ac.lastPositionUpdate >= existing.lastPositionUpdate) {
            // Merge sources from existing into new (in case a provider was temporarily down)
            for (const src of existing.sources) {
              if (!ac.sources.includes(src)) ac.sources.push(src)
            }
            // Merge military classification from existing
            if (existing.classification === 'military') ac.classification = 'military'
            map.set(ac.id, ac)
          }
          // If existing is fresher, keep existing but merge sources
          else {
            for (const src of ac.sources) {
              if (!existing.sources.includes(src)) {
                existing.sources.push(src)
              }
            }
          }
        } else {
          map.set(ac.id, ac)
        }
      }
    }

    // Remove stale aircraft regardless
    let staleCount = 0
    for (const [id, ac] of map) {
      if (now - ac.lastSeen > staleThreshold) {
        map.delete(id)
        staleCount++
      }
    }
    if (staleCount > 0) {
      console.log(`[AIRCRAFT] Removed ${staleCount} stale aircraft`)
    }

    if (!mountedRef.current) return

    // Push confirmed positions to display (no extrapolation on fresh data)
    const finalAircraft = Array.from(map.values())
    setAircraft(finalAircraft)

    // ── HAB/Site trace: check which HAB-near aircraft reached the hook ──
    for (const ac of finalAircraft) {
      const habDistM = haversineDistance(ac.latitude, ac.longitude, 28.4328, 45.9708)
      const habDistNm = habDistM / 1852
      if (habDistNm <= 100) {
        console.log(
          `[HAB TRACE HOOK] ICAO=${ac.id} Pos=(${ac.latitude.toFixed(4)},${ac.longitude.toFixed(4)}) ` +
          `DistFromHAB=${habDistNm.toFixed(1)}nm Speed=${ac.speed}kt Hdg=${ac.heading}° ` +
          `Sources=[${ac.sources.join(',')}] ` +
          `STATUS=IN_CONFIRMED_MAP`
        )
      }
    }
    // Log count of HAB-near aircraft in final state
    const habCount = finalAircraft.filter(ac => {
      const d = haversineDistance(ac.latitude, ac.longitude, 28.4328, 45.9708) / 1852
      return d <= 100
    }).length
    console.log(`[HAB TRACE HOOK] HAB-near aircraft in final state: ${habCount} / ${finalAircraft.length} total`)

    if (map.size === 0 && fetched.length === 0) {
      console.log('[AIRCRAFT] No aircraft in coverage area')
    }

    setLoading(false)
  }, [])

  // Poll on interval — use the most frequent provider's interval
  useEffect(() => {
    mountedRef.current = true
    fetchAndMerge()

    const intervals = [
      AIRCRAFT_CONFIG.providers.adsbLol.enabled ? AIRCRAFT_CONFIG.providers.adsbLol.pollIntervalMs : Infinity,
      AIRCRAFT_CONFIG.providers.adsbFi.enabled ? AIRCRAFT_CONFIG.providers.adsbFi.pollIntervalMs : Infinity,
      AIRCRAFT_CONFIG.providers.openSky.enabled ? AIRCRAFT_CONFIG.providers.openSky.pollIntervalMs : Infinity,
      AIRCRAFT_CONFIG.providers.airplanesLive.enabled ? AIRCRAFT_CONFIG.providers.airplanesLive.pollIntervalMs : Infinity,
    ]
    const minInterval = Math.min(...intervals)
    const interval = isFinite(minInterval) ? minInterval : 30000

    const id = setInterval(fetchAndMerge, interval)
    return () => {
      mountedRef.current = false
      clearInterval(id)
      fetchIdRef.current++
    }
  }, [fetchAndMerge])

  /**
   * Animation tick: recompute estimated positions FROM CONFIRMED positions.
   *
   * Every 1 second, for each aircraft with valid speed/heading, calculate
   * where it should be NOW based on its last CONFIRMED position + elapsed time.
   *
   * This does NOT mutate confirmedMap — it produces a fresh array each tick.
   * No compounding: each tick recalculates from scratch.
   */
  const tickRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      const map = confirmedMap.current
      if (map.size === 0) return

      const now = Date.now()

      // ── HAB trace: check HAB-near aircraft still in confirmedMap ──
      const habCountInTick = [...map.values()].filter(ac => {
        const d = haversineDistance(ac.latitude, ac.longitude, 28.4328, 45.9708) / 1852
        return d <= 100
      }).length
      if (habCountInTick > 0 && tickRef.current % 10 === 0) {
        console.log(`[HAB TRACE TICK] HAB-near in confirmedMap: ${habCountInTick}, tick=${tickRef.current}`)
      }

      const staleThreshold = AIRCRAFT_CONFIG.staleThresholdMs
      const result: Aircraft[] = []

      for (const ac of map.values()) {
        // Skip stale aircraft (use confirmed position instead of extrapolating stale data)
        if (now - ac.lastSeen > staleThreshold) continue

        // Try to extrapolate
        if (ac.speed != null && ac.speed >= 10 && ac.heading != null) {
          const extrapolated = extrapolatePosition(
            ac.latitude,  // confirmed latitude — NEVER an estimated one
            ac.longitude, // confirmed longitude — NEVER an estimated one
            ac.heading,
            ac.speed,
            ac.lastPositionUpdate,
            now,
          )

          if (extrapolated) {
            // ── HAB trace: check if extrapolation moves HAB-near aircraft ──
            const origHabDist = haversineDistance(ac.latitude, ac.longitude, 28.4328, 45.9708) / 1852
            const extrapHabDist = haversineDistance(extrapolated.latitude, extrapolated.longitude, 28.4328, 45.9708) / 1852
            if (origHabDist <= 100 || extrapHabDist <= 100) {
              if (tickRef.current % 10 === 0) {
                console.log(
                  `[HAB TRACE EXTRAP] ICAO=${ac.id} ` +
                  `orig=(${ac.latitude.toFixed(4)},${ac.longitude.toFixed(4)}) dist=${origHabDist.toFixed(1)}nm ` +
                  `extrap=(${extrapolated.latitude.toFixed(4)},${extrapolated.longitude.toFixed(4)}) dist=${extrapHabDist.toFixed(1)}nm ` +
                  `speed=${ac.speed}kt hdg=${ac.heading}° elapsed=${((now - ac.lastPositionUpdate)/1000).toFixed(0)}s`
                )
              }
            }
            // Create a shallow copy with the extrapolated position
            // lastSeen stays the same — extrapolation doesn't "refresh" staleness
            result.push({
              ...ac,
              latitude: extrapolated.latitude,
              longitude: extrapolated.longitude,
            })
            continue
          }
        }

        // No extrapolation possible — use confirmed position as-is
        result.push(ac)
      }

      if (result.length > 0) {
        setAircraft(result)
      }
    }, INTERPOLATION_INTERVAL_MS)

    return () => clearInterval(id)
  }, [])

  const toggleAircraft = useCallback(() => {
    setShowAircraft((prev) => !prev)
  }, [])

  return { aircraft, showAircraft, toggleAircraft, loading, diagnostics, providerMetrics, habDiagnostics, siteDiagnostics }
}