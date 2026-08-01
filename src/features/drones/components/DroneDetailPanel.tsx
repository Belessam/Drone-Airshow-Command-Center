import { useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useDronesData } from '@/hooks/useDronesData'
import { useAuth } from '@/hooks/useAuth'
import { useAllSites } from '@/hooks/useAllSites'
import { canManageDrone } from '@/lib/supabase/auth'
import { calculateBearing, calculateDistance } from '@/lib/simulation/engine'
import { simulationRunner } from '@/lib/simulation/runner'
import type { Drone } from '@/types'
import { UpdateDroneModal } from './UpdateDroneModal'
import { DroneTimeline } from './DroneTimeline'

interface DroneDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  drone: Drone | null
  onFocusMap?: (lat: number, lng: number) => void
  onViewHistory?: (droneId: string) => void
}

export function DroneDetailPanel({ isOpen, onClose, drone, onFocusMap, onViewHistory }: DroneDetailPanelProps) {
  const [showUpdate, setShowUpdate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { getDroneEvents, getDroneUpdates, deleteDrone } = useDronesData()
  const { user } = useAuth()
  // Site list resolved independently of the viewer's own site assignment.
  // The drone's SITE RELATIONSHIPS are display data about the drone itself —
  // they must render even when the viewer's assigned site differs.
  const sites = useAllSites()

  if (!drone) return null

  // Get site info for the drone's real source site
  const site = sites.find((s) => s.id === drone.source_site_id)
  const siteColor = site?.color || '#abc7ff'

  // Calculate elapsed time since last confirmed
  const lastUpdate = new Date(drone.last_confirmed_at).getTime()
  const elapsed = Date.now() - lastUpdate
  const elapsedMinutes = Math.floor(elapsed / 60000)
  const elapsedSeconds = Math.floor((elapsed % 60000) / 1000)

  const getFreshnessInfo = () => {
    if (elapsed < 120000) return { label: 'Fresh', color: '#22c55e' }
    if (elapsed < 300000) return { label: 'Recent', color: '#eab308' }
    if (elapsed < 600000) return { label: 'Stale', color: '#F2994A' }
    return { label: 'Critical', color: '#EF4444' }
  }
  const freshness = getFreshnessInfo()

  const statusColor = drone.simulation_status === 'simulating' ? '#2F80ED'
    : drone.simulation_status === 'paused' ? '#eab308'
    : '#8b919f'

  // Get estimated position from the simulation runner (site-relative)
  const runnerPos = simulationRunner.getPosition(drone.id)
  const estLat = runnerPos?.latitude ?? drone.last_confirmed_latitude
  const estLng = runnerPos?.longitude ?? drone.last_confirmed_longitude

  const updates = getDroneUpdates(drone.id)
  const events = getDroneEvents(drone.id)
  const updateCount = updates.length
  const eventCount = events.length

  // DEBUG: verify permission values at runtime
  console.log('[DETAIL]', JSON.stringify({
    userRole: user?.role,
    userSiteId: user?.site_id,
    droneId: drone.drone_id,
    droneSourceSiteId: drone.source_site_id,
    siteCode: site?.code,
    canManage: canManageDrone(user, drone.source_site_id),
    sitesCount: sites.length,
  }))
  const canManage = canManageDrone(user, drone.source_site_id)

  return (
    <>
      <Drawer isOpen={isOpen} onClose={onClose} width="w-full sm:w-[420px]">
        <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
          {/* Header — fixed at top */}
          <div className="p-5 border-b border-outline-variant shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-label-caps text-outline">DRONE SERIAL</span>
                <span className="bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold">ALPHA-01</span>
                <span className="text-label-caps text-[9px] text-outline border border-outline-variant px-1.5 py-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">precision_manufacturing</span>
                  DRONE
                </span>
              </div>
              <h2 className="text-headline-md text-on-surface">{drone.drone_id}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: statusColor,
                    boxShadow: drone.simulation_status === 'simulating' ? `0 0 8px ${statusColor}` : undefined,
                  }}
                />
                <span className="text-label-caps uppercase" style={{ color: statusColor }}>
                  {drone.simulation_status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Body — scrollable, takes remaining space */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5" style={{ minHeight: 0 }}>
            {/* Basic Meta */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-3">
                <p className="text-label-caps text-outline mb-1">SOURCE SITE</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: siteColor }} />
                  <p className="text-body-base font-bold" style={{ color: siteColor }}>
                    {site?.code || 'Unknown'} ({site?.name || ''})
                  </p>
                </div>
              </Card>
              <Card className="p-3">
                <p className="text-label-caps text-outline mb-1">FRESHNESS</p>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm icon-filled" style={{ color: '#abc7ff' }}>timer</span>
                  <p className="text-data-mono text-on-surface">
                    {elapsedMinutes > 0 ? `${elapsedMinutes}m ` : ''}{elapsedSeconds}s ago
                  </p>
                </div>
                <Badge variant="dot" color={freshness.color} className="mt-1">
                  {freshness.label}
                </Badge>
              </Card>
            </div>

            {/* Tactical Data */}
            <section>
              <h3 className="text-label-caps text-outline mb-3">TACTICAL DATA</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-container-highest border border-outline-variant p-2.5 text-center">
                  <p className="text-[10px] text-outline mb-1">HEADING</p>
                  <p className="text-data-mono text-on-surface text-lg">{drone.heading}°</p>
                  <div className="mt-1 flex justify-center">
                    <span
                      className="material-symbols-outlined text-primary inline-block"
                      style={{ fontSize: '18px', transform: `rotate(${drone.heading - 45}deg)` }}
                    >
                      navigation
                    </span>
                  </div>
                </div>
                <div className="bg-surface-container-highest border border-outline-variant p-2.5 text-center">
                  <p className="text-[10px] text-outline mb-1">SPEED</p>
                  <p className="text-data-mono text-on-surface text-lg">{drone.speed_mps}</p>
                  <p className="text-[9px] text-outline mt-1">{Math.round(drone.speed_mps * 3.6)} km/h</p>
                </div>
                <div className="bg-surface-container-highest border border-outline-variant p-2.5 text-center">
                  <p className="text-[10px] text-outline mb-1">ALTITUDE</p>
                  <p className="text-data-mono text-on-surface text-lg">{drone.last_confirmed_altitude}m</p>
                  <div className="w-full bg-outline-variant/30 h-1 mt-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (drone.last_confirmed_altitude / 400) * 100)}%`, backgroundColor: siteColor }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Position Matrix */}
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-label-caps text-outline">POSITIONS</h3>
                <span className="text-[10px] text-primary underline cursor-pointer">WGS84</span>
              </div>
              <div className="space-y-2">
                <div className="bg-surface p-3 border border-outline-variant flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant mb-1">CONFIRMED</p>
                    <p className="text-data-mono text-on-surface">
                      {drone.last_confirmed_latitude.toFixed(4)}° N, {Math.abs(drone.last_confirmed_longitude).toFixed(4)}° W
                    </p>
                  </div>
                  <span className="material-symbols-outlined icon-filled text-primary">verified</span>
                </div>
                <div className="bg-surface p-3 border border-outline-variant border-dashed flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-outline mb-1">ESTIMATED</p>
                    <p className="text-data-mono text-on-surface-variant">
                      {estLat.toFixed(4)}° N, {Math.abs(estLng).toFixed(4)}° W
                    </p>
                    {runnerPos && runnerPos.elapsedSeconds > 0 && (
                      <p className="text-[9px] text-outline font-data-mono mt-0.5">
                        {Math.round(runnerPos.elapsedSeconds)}s since last confirmed
                      </p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-outline">radar</span>
                </div>
              </div>
            </section>

            {/* Simulation Status */}
            <section className="bg-surface p-3 border border-outline-variant">
              <h3 className="text-label-caps text-outline mb-2">SIMULATION STATUS</h3>
              <div className="space-y-1.5 text-data-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-outline">Status</span>
                  <span style={{ color: statusColor }}>{drone.simulation_status.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Started</span>
                  <span className="text-on-surface">{drone.simulation_started_at ? new Date(drone.simulation_started_at).toLocaleTimeString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Data Freshness</span>
                  <span style={{ color: freshness.color }}>{freshness.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Total Updates</span>
                  <span className="text-on-surface">{updateCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Total Events</span>
                  <span className="text-on-surface">{eventCount}</span>
                </div>
              </div>
            </section>

            {/* Distance Matrix */}
            <section>
              <h3 className="text-label-caps text-outline mb-3">SITE RELATIONSHIPS</h3>
              <div className="space-y-2">
                {(() => {
                  // List all configured sites for this drone. `sites` comes from
                  // useAllSites() — the shared store + authoritative DB fetch —
                  // so it reflects the real site list even on pages that never
                  // mounted the sites data hook, and for ANY viewer role.
                  const allSites = sites
                  if (allSites.length === 0) {
                    return <p className="text-body-sm text-outline">No sites configured.</p>
                  }

                  // Compute the drone's estimated position
                  const runnerPos = simulationRunner.getPosition(drone.id)
                  const drnLat = runnerPos?.latitude ?? drone.last_confirmed_latitude
                  const drnLng = runnerPos?.longitude ?? drone.last_confirmed_longitude

                  // Build full relationship data for every site
                  const relationships = allSites.map(s => {
                    const distM = calculateDistance(drnLat, drnLng, s.latitude, s.longitude)
                    const distKm = distM / 1000
                    const droneToSite = calculateBearing(drnLat, drnLng, s.latitude, s.longitude)
                    const siteToDrone = calculateBearing(s.latitude, s.longitude, drnLat, drnLng)
                    const inRange = distKm <= s.radius_km
                    const isSource = s.id === drone.source_site_id

                    // Determine if drone is approaching or moving away from this site
                    // Compare drone heading to the bearing from drone → site
                    let approachStatus: string
                    if (drone.speed_mps < 0.5) {
                      approachStatus = 'STATIONARY'
                    } else {
                      const headingDiff = Math.abs(drone.heading - droneToSite)
                      const normalizedDiff = headingDiff <= 180 ? headingDiff : 360 - headingDiff
                      if (normalizedDiff <= 45) {
                        approachStatus = 'APPROACHING'
                      } else if (normalizedDiff >= 135) {
                        approachStatus = 'MOVING AWAY'
                      } else {
                        approachStatus = 'CROSSING'
                      }
                    }

                    return { site: s, distKm, droneToSite, siteToDrone, inRange, isSource, approachStatus }
                  })

                  // Sort by distance (nearest first)
                  relationships.sort((a, b) => a.distKm - b.distKm)
                  const nearestSite = relationships[0]

                  // Cardinal direction helper
                  function cardinal(bearing: number): string {
                    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
                    return dirs[Math.round(bearing / 22.5) % 16]
                  }

                  return relationships.map(rel => (
                    <div
                      key={rel.site.id}
                      className={`bg-surface p-3 border ${rel.isSource ? 'border-primary/40' : 'border-outline-variant'} ${rel.inRange ? '' : 'opacity-70'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rel.site.color }} />
                          <span className="text-label-caps font-bold" style={{ color: rel.site.color }}>
                            {rel.site.code}
                          </span>
                          {rel.isSource && (
                            <span className="text-[9px] text-primary border border-primary/30 px-1 py-0.5">SOURCE</span>
                          )}
                        </div>
                        <div style={{ color: rel.inRange ? '#22c55e' : '#EF4444' }}>
                          <span className="text-label-caps">
                            {rel.inRange ? 'IN RANGE' : 'OUT OF RANGE'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-data-mono text-[10px]">
                        <span className="text-outline">Distance</span>
                        <span className="text-on-surface text-right">{rel.distKm.toFixed(1)} km</span>

                        <span className="text-outline">Drone → Site</span>
                        <span className="text-right">
                          <span className="text-primary">{cardinal(rel.droneToSite)}</span>
                          <span className="text-outline ml-1">({rel.droneToSite.toFixed(0)}°)</span>
                        </span>

                        <span className="text-outline">Site → Drone</span>
                        <span className="text-right">
                          <span className="text-primary">{cardinal(rel.siteToDrone)}</span>
                          <span className="text-outline ml-1">({rel.siteToDrone.toFixed(0)}°)</span>
                        </span>

                        <span className="text-outline">Movement</span>
                        <span className="text-right" style={{
                          color: rel.approachStatus === 'APPROACHING' ? '#22c55e'
                            : rel.approachStatus === 'MOVING AWAY' ? '#EF4444'
                            : '#eab308'
                        }}>
                          {rel.approachStatus}
                        </span>

                        {rel.isSource && (
                          <>
                            <span className="text-outline">Range Limit</span>
                            <span className="text-on-surface text-right">{rel.site.radius_km} km</span>
                          </>
                        )}
                      </div>

                      {rel === nearestSite && (
                        <div className="mt-1.5 text-[9px] text-primary font-data-mono">← NEAREST SITE</div>
                      )}
                    </div>
                  ))
                })()}
              </div>
            </section>

            {/* Timeline */}
            <section>
              <h3 className="text-label-caps text-outline mb-4">MISSION TIMELINE</h3>
              <DroneTimeline droneId={drone.id} limit={6} />
            </section>
          </div>

          {/* Footer Actions — fixed, always visible */}
          <div className="p-4 bg-surface border-t border-outline-variant space-y-3 shrink-0">
            <Button
              variant="primary"
              className="w-full"
              icon="edit"
              onClick={() => setShowUpdate(true)}
            >
              Manual Update
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" icon="my_location" onClick={() => {
                onFocusMap?.(estLat, estLng)
                onClose()
              }}>Focus on Map</Button>
              <Button variant="secondary" icon="history" onClick={() => {
                if (onViewHistory) onViewHistory(drone.id)
                else onClose()
              }}>View History</Button>
            </div>
            {canManage && (
              !confirmDelete ? (
                <Button
                  variant="danger"
                  className="w-full"
                  icon="delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  Remove Drone
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-body-sm text-error text-center">Are you sure? This cannot be undone.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button variant="danger" icon="delete" onClick={async () => {
                      const ok = await deleteDrone(drone.id)
                      if (ok) onClose()
                      else setConfirmDelete(false)
                    }}>Confirm</Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </Drawer>

      <UpdateDroneModal
        isOpen={showUpdate}
        onClose={() => setShowUpdate(false)}
        drone={drone}
      />
    </>
  )
}
