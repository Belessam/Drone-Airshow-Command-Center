import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { TopBar } from '@/layouts/TopBar'
import { BottomBar } from '@/layouts/BottomBar'
import { Sidebar } from '@/layouts/Sidebar'
import { DroneDetailPanel } from '@/features/drones/components/DroneDetailPanel'
import { AddDroneModal } from '@/features/drones/components/AddDroneModal'
import { MapView } from '@/features/map/MapView'
import { useDronesData } from '@/hooks/useDronesData'
import { useSitesData } from '@/hooks/useSitesData'
import { useAuth } from '@/hooks/useAuth'
import { useSimulation } from '@/hooks/useSimulation'
import { useAircraft } from '@/hooks/useAircraft'
import { CoverageDiagnostics } from '@/components/aircraft/CoverageDiagnostics'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { isDemoMode, getDemoSites } from '@/utils/demoMode'
import { setSiteLocations } from '@/features/aircraft/geography'
import { calculateBearing, calculateDistance } from '@/lib/simulation/engine'
import { canManageDrone } from '@/lib/supabase/auth'
import { subscribeToSites } from '@/lib/siteStore'
import type { Drone, Site } from '@/types'
import type { Aircraft, ProviderMetrics, MergeDiagnostics } from '@/features/aircraft/types'

function bearingLabel(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant p-2.5">
      <p className="text-label-caps text-outline text-[9px] mb-0.5">{label}</p>
      <p className="text-data-mono text-on-surface text-xs truncate">{value}</p>
    </div>
  )
}

export function DashboardPage() {
  const { user, userSite } = useAuth()
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null)
  const [showAddDrone, setShowAddDrone] = useState(false)
  // Operating Sites panel: open by default on desktop/tablet (>=768px),
  // closed by default on mobile so the map is the primary focus. The
  // "Sites" legend control / site markers open it on mobile.
  const [showSites, setShowSites] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  const [focusSiteState, setFocusSiteState] = useState<{ site: Site; key: number } | null>(null)
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)

  const { drones, loading: dronesLoading, deleteDrone } = useDronesData()
  const { sites: dbSites, droneCounts } = useSitesData()
  // Use shared store for sites so edits on SitesPage instantly update this component.
  // CRITICAL: In production mode, do NOT fall back to demo sites — if Supabase
  // returns no data, show an empty array so the UI reflects reality instead of
  // silently substituting fake coordinates. The shared store subscription
  // below will fill in the real sites when they arrive.
  const [sites, setSites] = useState<Site[]>(() => {
    if (isDemoMode()) return getDemoSites()
    return dbSites || []
  })
  useEffect(() => {
    // Listen for site updates from the shared store
    const unsub = subscribeToSites((shared) => {
      console.log('[SITE UPDATE] received shared sites update:', shared.length)
      if (isDemoMode()) {
        setSites(getDemoSites())
      } else if (shared.length > 0) {
        setSites(shared)
      }
    })
    return unsub
  }, [])
  // Also sync from dbSites on first load
  useEffect(() => {
    if (dbSites.length > 0) {
      const s = isDemoMode() ? getDemoSites() : dbSites
      setSites(s)
    }
  }, [dbSites])

  // ── Feature 1: Stale Drone Confirmation ──
  const [staleConfirmDrone, setStaleConfirmDrone] = useState<Drone | null>(null)
  const staleSuppressedUntil = useRef<Record<string, number>>({})
  // Check selected drone for staleness whenever it changes
  useEffect(() => {
    if (!selectedDrone) { setStaleConfirmDrone(null); return }
    const now = Date.now()
    const lastConfirmed = new Date(selectedDrone.last_confirmed_at).getTime()
    const elapsedMs = now - lastConfirmed
    const STALE_MS = 5 * 60 * 1000 // 5 minutes
    if (elapsedMs > STALE_MS) {
      const suppressedUntil = staleSuppressedUntil.current[selectedDrone.id]
      if (!suppressedUntil || now > suppressedUntil) {
        setStaleConfirmDrone(selectedDrone)
      }
    }
  }, [selectedDrone])

  // ── Feature 2: Duplicate Drone Detection ──
  const [duplicatePair, setDuplicatePair] = useState<{ a: Drone; b: Drone } | null>(null)
  const duplicateSuppressedUntil = useRef<Record<string, number>>({})

  const liveDrones = drones
  // ── Feature 2: Duplicate Drone Detection effect ──
  useEffect(() => {
    const active = liveDrones.filter(d => d.is_active && d.simulation_status === 'simulating')
    const now = Date.now()
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j]
        // Skip if same source site — likely intentional co-patrol
        if (a.source_site_id === b.source_site_id) continue

        // Check suppression
        const pairKey = [a.id, b.id].sort().join('|')
        const suppressed = duplicateSuppressedUntil.current[pairKey]
        if (suppressed && now < suppressed) continue

        // Distance check
        const distM = calculateDistance(a.last_confirmed_latitude, a.last_confirmed_longitude, b.last_confirmed_latitude, b.last_confirmed_longitude)
        if (distM > 1000) continue // > 1km

        // Heading check
        const headingDiff = Math.abs(a.heading - b.heading)
        const normalizedHeadingDiff = headingDiff <= 180 ? headingDiff : 360 - headingDiff
        if (normalizedHeadingDiff > 15) continue

        // Speed check (within 15%)
        const maxSpeed = Math.max(a.speed_mps, b.speed_mps)
        const minSpeed = Math.min(a.speed_mps, b.speed_mps)
        if (maxSpeed === 0 || minSpeed / maxSpeed < 0.85) continue

        // Same simulation state
        if (a.simulation_status !== b.simulation_status) continue

        // Matched! Show dialog
        setDuplicatePair({ a, b })
        return // only one dialog at a time
      }
    }
  }, [liveDrones])
  const liveSites = useMemo(() => {
    if (isDemoMode()) return getDemoSites()
    // In production, use live Supabase data. If empty, return empty — do NOT
    // substitute demo coordinates. The sites array will fill in from Supabase
    // shortly after mount.
    return sites || []
  }, [sites])

  // Keep a ref for stable callbacks that need current site data
  const liveSitesRef = useRef(liveSites)
  liveSitesRef.current = liveSites

  // CRITICAL: Populate site locations for the geographic coverage engine.
  // Called BOTH synchronously (for immediate availability) and in useEffect
  // (to catch async updates). Without this, isNearAnySite() returns false
  // for ALL aircraft and site-specific query cells are never generated.
  const siteDataForGeo = useMemo(() =>
    liveSites.map(s => ({
      id: s.id,
      code: s.code,
      latitude: s.latitude,
      longitude: s.longitude,
    })),
    [liveSites]
  )
  // Synchronous call — ensures sites are loaded before useAircraft's first fetch
  if (siteDataForGeo.length > 0) {
    setSiteLocations(siteDataForGeo)
  }
  useEffect(() => {
    if (siteDataForGeo.length > 0) {
      setSiteLocations(siteDataForGeo)
    }
  }, [siteDataForGeo])

  const { positions: simPositions } = useSimulation(liveDrones)
  const { aircraft, showAircraft, toggleAircraft, diagnostics, providerMetrics, habDiagnostics, siteDiagnostics } = useAircraft()

  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  // ── Fullscreen map mode ──
  // Uses the browser Fullscreen API where supported, and always applies an
  // app-level fallback (hide surrounding chrome, map fills viewport).
  const [mapFullscreen, setMapFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => {
    const next = !mapFullscreen
    setMapFullscreen(next)
    try {
      if (next) {
        const el = document.documentElement
        const req = (el as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen
        if (req) req.call(el).catch(() => { /* native fullscreen unsupported — app fallback still applies */ })
      } else if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    } catch {
      /* no-op: app-level fallback handles it */
    }
  }, [mapFullscreen])

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setMapFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const activeDrones = liveDrones.filter((d) => d.is_active).length

  // Compute simulation-based drone positions
  const dronePositions = liveDrones.filter((d) => d.is_active).map((d) => {
    const site = liveSites.find((s) => s.id === d.source_site_id)
    const simPos = simPositions.get(d.id)
    const estimatedLat = simPos?.latitude ?? d.last_confirmed_latitude
    const estimatedLng = simPos?.longitude ?? d.last_confirmed_longitude
    const heading = simPos?.heading ?? d.heading

    return {
      ...d,
      siteColor: site?.color || '#8b949e',
      estimatedLat,
      estimatedLng,
      heading,
      elapsedMinutes: Math.floor((Date.now() - new Date(d.last_confirmed_at).getTime()) / 60000),
    }
  })

  const mapMarkers = useMemo(() => dronePositions.map((d) => ({
    id: d.id,
    drone_id: d.drone_id,
    latitude: d.estimatedLat,
    longitude: d.estimatedLng,
    heading: d.heading,
    siteColor: d.siteColor,
    isStale: d.elapsedMinutes > 5,
    simulationStatus: d.simulation_status,
    sourceSiteId: d.source_site_id,
  })), [dronePositions])

  const mapSites = useMemo(() => liveSites.map((s) => ({
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    color: s.color,
    name: s.name,
    code: s.code,
  })), [liveSites])

  // Selected site object
  const selectedSite = liveSites.find((s) => s.id === selectedSiteId) || null
  const selectedDroneSite = selectedDrone
    ? liveSites.find((s) => s.id === selectedDrone.source_site_id)
    : null

  // Drones belonging to selected site
  const siteDrones = useMemo(() => {
    if (!selectedSiteId) return []
    return dronePositions.filter(d => d.source_site_id === selectedSiteId)
  }, [dronePositions, selectedSiteId])

  const handleDroneClick = useCallback((droneId: string) => {
    const drone = liveDrones.find((d) => d.id === droneId || d.drone_id === droneId)
    if (drone) setSelectedDrone(drone)
  }, [liveDrones])

  const handleSiteClick = useCallback((siteId: string) => {
    setSelectedDrone(null)
    const site = liveSitesRef.current.find((s) => s.id === siteId)
    if (site && site.latitude && site.longitude) {
      setFocusSiteState({ site, key: Date.now() })
      setSelectedSiteId(siteId)
      // On mobile, tapping a site only selects/highlights it — do NOT open the
      // site status panel so the location info bar stays visible. Desktop/tablet
      // keeps the existing open-panel behavior.
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setShowSites(true)
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      {!mapFullscreen && <TopBar onAddDrone={() => setShowAddDrone(true)} />}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile: sidebar as drawer, Desktop: sidebar always visible */}
        {!mapFullscreen && (
          <div className="hidden md:flex shrink-0">
            <Sidebar onAddDrone={() => setShowAddDrone(true)} />
          </div>
        )}

        <main className={`relative flex-1 overflow-hidden ${mapFullscreen ? 'fixed inset-0 z-40' : ''}`} style={{ backgroundColor: '#0A0C10' }}>
          <MapView
            drones={mapMarkers}
            sites={mapSites}
            aircraft={aircraft}
            showAircraft={showAircraft}
            onDroneClick={handleDroneClick}
            onAircraftClick={(ac) => setSelectedAircraft(ac as Aircraft)}
            selectedDroneId={selectedDrone?.id || null}
            focusLatitude={focusSiteState?.site?.latitude ?? userSite?.latitude}
            focusLongitude={focusSiteState?.site?.longitude ?? userSite?.longitude}
            focusKey={focusSiteState?.key}
            onSiteClick={handleSiteClick}
            selectedSiteId={selectedSiteId}
            isFullscreen={mapFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />

          {/* Coverage Diagnostics (dev mode or ?diagnostics) */}
          {showDiagnostics && (
            <CoverageDiagnostics
              providerMetrics={providerMetrics}
              mergeDiagnostics={diagnostics}
              habDiagnostics={habDiagnostics}
              siteDiagnostics={siteDiagnostics}
            />
          )}

          {dronesLoading && (
            <div className="absolute top-4 right-4 z-30">
              <span className="text-data-mono text-[10px] text-primary">Loading drone data...</span>
            </div>
          )}

          {/* Operating Sites + Site Details Panel
              Mobile: fixed bottom sheet that slides up, fits the viewport,
              easy to close, never permanently covers the map.
              Desktop/tablet: absolute overlay (unchanged). */}
          {showSites && (
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[62dvh] rounded-t-lg border border-b-0 border-outline-variant bg-surface-container/95 backdrop-blur-md animate-slide-up pb-[env(safe-area-inset-bottom,0px)] flex flex-col text-[11px] md:absolute md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:w-72 md:max-h-[70vh] md:rounded-none md:border-b md:bg-surface-container/90 md:backdrop-blur-none md:animate-none sm:text-[inherit]">
              {/* Site Details when a site is selected */}
              {selectedSite ? (
                <>
                  <div className="p-3 border-b border-outline-variant bg-surface-container-high">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedSite.color }} />
                        <span className="text-label-caps text-primary">{selectedSite.code}</span>
                      </div>
                      <button
                        onClick={() => setSelectedSiteId(null)}
                        className="text-outline hover:text-on-surface text-[11px]"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                    <p className="text-headline-sm text-on-surface">{selectedSite.name}</p>
                    <div className="flex gap-4 mt-1 text-data-mono text-[9px] text-outline">
                      <span>{selectedSite.latitude.toFixed(4)}° N</span>
                      <span>{Math.abs(selectedSite.longitude).toFixed(4)}° W</span>
                      <span>{selectedSite.radius_km}km RAD</span>
                    </div>
                  </div>

                  <div className="p-3 border-b border-outline-variant bg-surface-container/50">
                    <p className="text-label-caps text-[9px] text-outline mb-2">ACTIVE DRONES: {siteDrones.length}</p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {siteDrones.length === 0 ? (
                        <p className="text-body-sm text-on-surface-variant text-[10px]">No active drones assigned.</p>
                      ) : (
                        siteDrones.map((d) => {
                          const brg = calculateBearing(selectedSite.latitude, selectedSite.longitude, d.estimatedLat, d.estimatedLng)
                          const rangeKm = calculateDistance(selectedSite.latitude, selectedSite.longitude, d.estimatedLat, d.estimatedLng) / 1000
                          return (
                            <div
                              key={d.id}
                              className="bg-surface-container-low border border-outline-variant p-2 cursor-pointer hover:bg-surface-variant/40 transition-colors"
                              onClick={() => {
                                const drone = liveDrones.find(dr => dr.id === d.id || dr.drone_id === d.drone_id)
                                if (drone) setSelectedDrone(drone)
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-data-mono text-[10px] font-bold" style={{ color: d.siteColor }}>{d.drone_id}</span>
                                <span className="text-data-mono text-[8px] text-on-surface-variant capitalize">{d.simulation_status}</span>
                              </div>
                              <div className="flex justify-between text-data-mono text-[8px] text-on-surface-variant mt-1">
                                <span>RNG: {rangeKm.toFixed(1)}km</span>
                                <span>BRG: {brg.toFixed(0)}° {bearingLabel(brg)}</span>
                                <span>HDG: {d.heading.toFixed(0)}°</span>
                                <span>{d.speed_mps}m/s</span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Drone telemetry when selected */}
                  {selectedDrone && selectedDroneSite && (
                    <div className="p-3 bg-surface-container-low border-t border-outline-variant">
                      <p className="text-label-caps text-[9px] text-outline mb-1">SELECTED DRONE</p>
                      <p className="text-data-mono text-[10px] font-bold" style={{ color: selectedDroneSite.color }}>
                        {selectedDrone.drone_id}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-data-mono text-[8px] text-on-surface-variant">
                        <span>ALT: {selectedDrone.last_confirmed_altitude}m</span>
                        <span>HDG: {selectedDrone.heading}°</span>
                        <span>SPD: {selectedDrone.speed_mps}m/s</span>
                        {(() => {
                          const brg = calculateBearing(selectedDroneSite.latitude, selectedDroneSite.longitude, dronePositions.find(p => p.id === selectedDrone.id)?.estimatedLat ?? selectedDrone.last_confirmed_latitude, dronePositions.find(p => p.id === selectedDrone.id)?.estimatedLng ?? selectedDrone.last_confirmed_longitude)
                          const range = calculateDistance(selectedDroneSite.latitude, selectedDroneSite.longitude, dronePositions.find(p => p.id === selectedDrone.id)?.estimatedLat ?? selectedDrone.last_confirmed_latitude, dronePositions.find(p => p.id === selectedDrone.id)?.estimatedLng ?? selectedDrone.last_confirmed_longitude) / 1000
                          return <><span>FROM {selectedDroneSite.code}: {brg.toFixed(0)}° {bearingLabel(brg)}</span><span>RNG: {range.toFixed(1)}km</span></>
                        })()}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Operating Sites List — no site selected */
                <>
                  <div className="p-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-high">
                    <span className="text-label-caps font-label-caps">Operating Sites</span>
                    <div className="flex items-center gap-3">
                      <span className="text-data-mono text-[10px] text-on-surface-variant">
                        {String(liveSites.length).padStart(2, '0')} ACTIVE
                      </span>
                      <button
                        onClick={() => setShowSites(false)}
                        className="md:hidden text-outline hover:text-on-surface text-[11px] flex items-center justify-center w-8 h-8"
                        aria-label="Close operating sites panel"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col max-h-[400px] overflow-y-auto custom-scrollbar">
                    {liveSites.map((site) => {
                      const count = isDemoMode()
                        ? droneCounts[site.id] || liveDrones.filter((dr) => dr.source_site_id === site.id && dr.is_active).length
                        : droneCounts[site.id] || 0
                      return (
                        <div
                          key={site.id}
                          className="p-3 border-b border-outline-variant last:border-b-0 transition-colors cursor-pointer hover:bg-surface-variant/30 border-l-2 border-transparent"
                          onClick={() => handleSiteClick(site.id)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: site.color }} />
                            <span className="text-label-caps font-label-caps">{site.code} - {site.name}</span>
                          </div>
                          <div className="flex justify-between text-data-mono text-[10px] text-on-surface-variant">
                            <span>DRONES: {count}</span>
                            <span>RAD: {site.radius_km}KM</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Layer Toggles + Aircraft Legend — compact on mobile */}
          <div className="absolute bottom-1.5 md:bottom-2 left-1.5 md:left-2 z-30 flex gap-2 max-w-[calc(100vw-16px)]">
            <div className="bg-surface-container/90 border border-outline-variant px-2.5 md:px-3 py-1 md:py-1.5 shadow-lg max-w-full">
              <div className="flex items-center gap-2 md:gap-3 mb-0.5 md:mb-1 flex-wrap">
                <button
                  className={`flex items-center gap-1 min-h-0 py-0 text-[10px] md:text-label-caps transition-colors ${showSites ? 'text-[#2F80ED]' : 'text-outline'}`}
                  onClick={() => setShowSites(!showSites)}
                >
                  <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${showSites ? 'bg-[#2F80ED]' : 'bg-outline'}`} />
                  Sites
                </button>
                <span className="text-outline/20">|</span>
                <span className="flex items-center gap-1 min-h-0 text-[10px] md:text-label-caps text-[#F2994A]">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#F2994A]" />
                  Drones
                </span>
                <span className="text-outline/20">|</span>
                <button
                  className={`flex items-center gap-1 min-h-0 py-0 text-[10px] md:text-label-caps transition-colors ${showAircraft ? 'text-[#56CCF2]' : 'text-outline'}`}
                  onClick={toggleAircraft}
                >
                  <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${showAircraft ? 'bg-[#56CCF2]' : 'bg-outline'}`} />
                  Aircraft
                </button>
              </div>
              {showAircraft && (
                <div className="flex items-center gap-2 md:gap-3 pt-1 border-t border-outline-variant/30 flex-wrap">
                  <span className="flex items-center gap-1 min-h-0 text-[9px] md:text-label-caps text-[10px] text-[#56CCF2]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#56CCF2]" /> Civilian
                  </span>
                  <span className="flex items-center gap-1 min-h-0 text-[9px] md:text-label-caps text-[10px] text-[#EF4444]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" /> Military
                  </span>
                  <span className="flex items-center gap-1 min-h-0 text-[9px] md:text-label-caps text-[10px] text-[#F2994A]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F2994A]" /> Unknown
                  </span>
                  <span className="text-outline/20">|</span>
                  <button
                    className={`flex items-center gap-1 min-h-0 py-0 text-[9px] md:text-label-caps text-[10px] transition-colors ${showDiagnostics ? 'text-[#8B5CF6]' : 'text-outline'}`}
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${showDiagnostics ? 'bg-[#8B5CF6]' : 'bg-outline'}`} />
                    Diag
                  </button>
                </div>
              )}
            </div>
          </div>

        </main>

        <DroneDetailPanel
          isOpen={!!selectedDrone}
          onClose={() => setSelectedDrone(null)}
          drone={selectedDrone}
          onFocusMap={(lat, lng) => {
            setFocusSiteState({ site: { latitude: lat, longitude: lng } as Site, key: Date.now() })
          }}
          onViewHistory={(droneId) => {
            // Navigate to history page with drone filter
            window.location.href = `/history?drone=${droneId}`
          }}
        />

        {/* Aircraft Details Drawer */}
        {selectedAircraft && (
          <div className="fixed right-0 top-0 h-full w-full sm:w-[360px] bg-surface-container/95 backdrop-blur-md border-l border-outline-variant z-[60] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-outline-variant shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-label-caps text-outline">AIRCRAFT</span>
                <button onClick={() => setSelectedAircraft(null)} className="text-on-surface-variant hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: selectedAircraft.classification === 'military' ? '#EF4444'
                      : selectedAircraft.classification === 'civilian' ? '#56CCF2'
                      : '#F2994A',
                  }}
                />
                <span className="text-label-caps uppercase" style={{
                  color: selectedAircraft.classification === 'military' ? '#EF4444'
                    : selectedAircraft.classification === 'civilian' ? '#56CCF2'
                    : '#F2994A',
                }}>
                  {selectedAircraft.classification}
                </span>
              </div>
              <h2 className="text-headline-md text-on-surface mt-1">{selectedAircraft.callsign || selectedAircraft.id}</h2>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="CLASSIFICATION" value={selectedAircraft.classification.toUpperCase()} />
                {selectedAircraft.sources && selectedAircraft.sources.length > 0 && (
                  <div className="col-span-2 bg-surface-container-lowest border border-outline-variant p-2.5">
                    <p className="text-label-caps text-outline text-[9px] mb-1">SOURCES ({selectedAircraft.sources.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedAircraft.sources.map((src) => (
                        <span
                          key={src}
                          className="text-data-mono text-[9px] px-1.5 py-0.5 rounded-sm"
                          style={{
                            backgroundColor:
                              src === 'adsb.lol' ? 'rgba(86,204,242,0.15)' :
                              src === 'adsb.lol.mil' ? 'rgba(239,68,68,0.15)' :
                              src === 'adsb.fi' ? 'rgba(52,211,153,0.15)' :
                              src === 'openSky' ? 'rgba(242,153,74,0.15)' :
                              src === 'airplanes.live' ? 'rgba(139,92,246,0.15)' :
                              'rgba(107,114,128,0.15)',
                            color:
                              src === 'adsb.lol' ? '#56CCF2' :
                              src === 'adsb.lol.mil' ? '#EF4444' :
                              src === 'adsb.fi' ? '#34D399' :
                              src === 'openSky' ? '#F2994A' :
                              src === 'airplanes.live' ? '#8B5CF6' :
                              '#6b7280',
                          }}
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedAircraft.callsign && <InfoRow label="CALLSIGN" value={selectedAircraft.callsign} />}
                <InfoRow label="ICAO24" value={selectedAircraft.id} />
                {selectedAircraft.aircraftType && <InfoRow label="TYPE" value={selectedAircraft.aircraftType} />}
                {selectedAircraft.registration && <InfoRow label="REGISTRATION" value={selectedAircraft.registration} />}
                <InfoRow label="LATITUDE" value={`${selectedAircraft.latitude.toFixed(4)}°`} />
                <InfoRow label="LONGITUDE" value={`${selectedAircraft.longitude.toFixed(4)}°`} />
                {selectedAircraft.altitude != null && <InfoRow label="ALTITUDE" value={`${selectedAircraft.altitude} ft`} />}
                {selectedAircraft.speed != null && <InfoRow label="SPEED" value={`${selectedAircraft.speed} kts`} />}
                {selectedAircraft.heading != null && <InfoRow label="HEADING" value={`${selectedAircraft.heading}°`} />}
                {selectedAircraft.verticalRate != null && <InfoRow label="V/S" value={`${selectedAircraft.verticalRate} ft/min`} />}
              </div>
            </div>
          </div>
        )}
      </div>
      {!mapFullscreen && <BottomBar activeDrones={activeDrones} />}
      <AddDroneModal
        isOpen={showAddDrone}
        onClose={() => setShowAddDrone(false)}
        liveSites={liveSites}
        onCreated={(loc) => {
          // Focus map on the newly deployed drone
          if (loc) {
            setFocusSiteState({ site: { id: '', latitude: loc.latitude, longitude: loc.longitude } as Site, key: Date.now() })
          }
        }}
      />

      {/* ── Stale Drone Confirmation Modal ── */}
      {staleConfirmDrone && user && canManageDrone(user, staleConfirmDrone.source_site_id) && (() => {
        return (
          <Modal
            isOpen={true}
            onClose={() => setStaleConfirmDrone(null)}
            title="Drone has not received updates"
            size="md"
          >
            <div className="space-y-4">
              <div className="bg-error-container/10 border border-error/20 p-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-error text-lg shrink-0">warning</span>
                <p className="text-body-sm text-on-surface-variant">
                  <strong className="text-on-surface">{staleConfirmDrone.drone_id}</strong> has not received any update for more than 5 minutes.
                  <br />
                  Last confirmed: <span className="text-data-mono text-outline">
                    {new Date(staleConfirmDrone.last_confirmed_at).toLocaleTimeString()}
                  </span>
                  <br /><br />
                  Do you want to remove it from tracking or continue monitoring it?
                </p>
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-3 grid grid-cols-2 gap-4 text-data-mono text-[10px]">
                <span className="text-outline">Drone ID</span>
                <span className="text-on-surface text-right">{staleConfirmDrone.drone_id}</span>
                <span className="text-outline">Last update</span>
                <span className="text-on-surface text-right">
                  {Math.floor((Date.now() - new Date(staleConfirmDrone.last_confirmed_at).getTime()) / 60000)} minutes ago
                </span>
                <span className="text-outline">Status</span>
                <span className="text-error text-right">STALE</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    staleSuppressedUntil.current[staleConfirmDrone.id] = Date.now() + 5 * 60 * 1000
                    setStaleConfirmDrone(null)
                  }}
                >
                  Continue Monitoring
                </Button>
                <Button
                  variant="danger"
                  icon="delete"
                  onClick={async () => {
                    const drone = staleConfirmDrone
                    setStaleConfirmDrone(null)
                    await deleteDrone(drone.id)
                    setSelectedDrone(null)
                  }}
                >
                  Remove Drone
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* ── Duplicate Drone Merge Modal ── */}
      {duplicatePair && (() => {
        const { a, b } = duplicatePair
        const distM = calculateDistance(a.last_confirmed_latitude, a.last_confirmed_longitude, b.last_confirmed_latitude, b.last_confirmed_longitude)
        const headingDiff = Math.abs(a.heading - b.heading)
        const normalizedHeadingDiff = headingDiff <= 180 ? headingDiff : 360 - headingDiff
        const speedDiffPct = Math.abs(a.speed_mps - b.speed_mps) / Math.max(a.speed_mps, b.speed_mps) * 100
        // Oldest drone ID should be the keeper
        const aAge = new Date(a.created_at).getTime()
        const bAge = new Date(b.created_at).getTime()
        const keeper = aAge <= bAge ? a : b
        const duplicate = aAge <= bAge ? b : a
        return (
          <Modal
            isOpen={true}
            onClose={() => setDuplicatePair(null)}
            title="Possible duplicate drones detected"
            size="md"
          >
            <div className="space-y-4">
              <div className="bg-[#F2994A]/10 border border-[#F2994A]/30 p-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#F2994A] text-lg shrink-0">call_split</span>
                <p className="text-body-sm text-on-surface-variant">
                  Two drones appear to be the same object. They are within 1km of each other with matching
                  heading, speed, and simulation status.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low border border-outline-variant p-3">
                  <p className="text-label-caps text-primary mb-1">DRONE A (KEEPER)</p>
                  <p className="text-data-mono text-on-surface text-sm">{keeper.drone_id}</p>
                  <p className="text-[9px] text-outline mt-1">Created: {new Date(keeper.created_at).toLocaleDateString()}</p>
                  <p className="text-[9px] text-outline">Speed: {keeper.speed_mps} m/s | Hdg: {keeper.heading}°</p>
                </div>
                <div className="bg-surface-container-low border border-outline-variant p-3">
                  <p className="text-label-caps text-[#EF4444] mb-1">DRONE B (DUPLICATE)</p>
                  <p className="text-data-mono text-on-surface text-sm">{duplicate.drone_id}</p>
                  <p className="text-[9px] text-outline mt-1">Created: {new Date(duplicate.created_at).toLocaleDateString()}</p>
                  <p className="text-[9px] text-outline">Speed: {duplicate.speed_mps} m/s | Hdg: {duplicate.heading}°</p>
                </div>
              </div>

              <div className="bg-surface-container-low border border-outline-variant p-3 grid grid-cols-2 gap-3 text-data-mono text-[10px]">
                <span className="text-outline">Distance</span>
                <span className="text-on-surface text-right">{distM.toFixed(0)} m</span>
                <span className="text-outline">Heading Difference</span>
                <span className="text-on-surface text-right">{normalizedHeadingDiff}°</span>
                <span className="text-outline">Speed Difference</span>
                <span className="text-on-surface text-right">{speedDiffPct.toFixed(0)}%</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    // Ignore — suppress for 10 minutes
                    const pairKey = [a.id, b.id].sort().join('|')
                    duplicateSuppressedUntil.current[pairKey] = Date.now() + 10 * 60 * 1000
                    setDuplicatePair(null)
                  }}
                >
                  Ignore
                </Button>
                <Button
                  variant="primary"
                  icon="merge"
                  onClick={async () => {
                    await deleteDrone(duplicate.id)
                    const pairKey = [a.id, b.id].sort().join('|')
                    duplicateSuppressedUntil.current[pairKey] = Infinity // never show again
                    setDuplicatePair(null)
                  }}
                >
                  Merge (keep {keeper.drone_id})
                </Button>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
