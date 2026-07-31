import { useState } from 'react'
import { PageLayout } from '@/layouts/PageLayout'
import { DroneDetailPanel } from '@/features/drones/components/DroneDetailPanel'
import { AddDroneModal } from '@/features/drones/components/AddDroneModal'
import { useDronesData } from '@/hooks/useDronesData'
import { useAuth } from '@/hooks/useAuth'
import { isDemoMode, getDemoSites } from '@/utils/demoMode'
import type { Drone } from '@/types'

export function DronesPage() {
  const { drones, loading } = useDronesData()
  const { user, isMasterAdmin, isAdmin, sites } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null)
  const [showAddDrone, setShowAddDrone] = useState(false)

  // Regular admin sees only their site's drones; master admin sees all
  const liveDrones = drones.filter((d) => {
    if (isMasterAdmin) return true
    if ((isAdmin || !isMasterAdmin) && user?.site_id) return d.source_site_id === user.site_id
    return true
  })

  const filteredDrones = liveDrones.filter((d) => {
    const matchesSearch = d.drone_id.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All Statuses' || d.simulation_status === statusFilter.toLowerCase()
    return matchesSearch && matchesStatus
  })

  const getFreshnessInfo = (lastConfirmedAt: string) => {
    const elapsed = Date.now() - new Date(lastConfirmedAt).getTime()
    if (elapsed < 120000) return { label: 'Fresh', color: '#22c55e' }
    if (elapsed < 300000) return { label: 'Recent', color: '#eab308' }
    if (elapsed < 600000) return { label: 'Stale', color: '#F2994A' }
    return { label: 'Critical', color: '#EF4444' }
  }

  return (
    <PageLayout title="Drone Airshow Command Center">
      {/* Tool Bar */}
      <section className="p-grid-gutter bg-surface-container-low flex flex-col gap-4 border-b border-outline-variant">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-headline-md text-on-surface">Drone Fleet</h2>
            <p className="text-body-sm text-on-surface-variant">
              Manage telemetry and synchronization for {liveDrones.filter((d) => d.is_active).length} active units.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <input
                className="bg-surface-container text-on-surface border border-outline-variant pl-10 pr-4 py-2 text-body-sm w-64 focus:border-primary focus:ring-0 outline-none transition-all"
                placeholder="Search Drone ID..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">
                search
              </span>
            </div>
            {(isMasterAdmin || isAdmin) && (
            <button
              onClick={() => setShowAddDrone(true)}
              className="bg-primary text-on-primary px-4 py-2 text-label-caps hover:brightness-110 transition-all active:scale-95 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Register
            </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded border border-outline-variant">
            <span className="text-label-caps text-on-surface-variant">Filter by Status:</span>
            <select
              className="bg-transparent text-label-caps text-primary border-none p-0 focus:ring-0 cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All Statuses</option>
              <option>Simulating</option>
              <option>Paused</option>
              <option>Stopped</option>
            </select>
          </div>
          <div className="ml-auto flex gap-3 text-data-mono text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2F80ED]" /> Confirmed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F2994A]" /> Simulating</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EB5757]" /> Critical</span>
          </div>
        </div>
      </section>

      {/* Table View */}
      <section className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-surface-container-highest z-20">
            <tr className="border-b border-outline-variant">
              <th className="px-6 py-3 text-label-caps text-outline uppercase tracking-wider">Drone ID</th>
              <th className="px-6 py-3 text-label-caps text-outline uppercase tracking-wider">Source Site</th>
              <th className="px-6 py-3 text-label-caps text-outline uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-label-caps text-outline uppercase tracking-wider">Heading</th>
              <th className="px-6 py-3 text-label-caps text-outline uppercase tracking-wider">Speed</th>
              <th className="px-6 py-3 text-label-caps text-outline uppercase tracking-wider">Altitude</th>
              <th className="px-6 py-3 text-label-caps text-outline uppercase tracking-wider">Freshness</th>
              <th className="px-6 py-3 text-label-caps text-outline uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {filteredDrones.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <span className="material-symbols-outlined text-outline text-3xl block mb-2">search_off</span>
                  <p className="text-body-sm text-on-surface-variant">No drones match your filters.</p>
                </td>
              </tr>
            ) : (
              filteredDrones.map((drone) => {
                const site = (sites.length > 0 ? sites : isDemoMode() ? getDemoSites() : []).find((s) => s.id === drone.source_site_id)
                const siteColor = site?.color || '#8b949e'
                const freshness = getFreshnessInfo(drone.last_confirmed_at)
                const statusColor = drone.simulation_status === 'simulating' ? '#F2994A'
                  : drone.simulation_status === 'paused' ? '#eab308'
                  : '#8b919f'

                return (
                  <tr
                    key={drone.id}
                    className="data-row transition-colors cursor-pointer"
                    onClick={() => setSelectedDrone(drone)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">airplanemode_active</span>
                        <span className="text-data-mono text-on-surface">{drone.drone_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2 py-0.5 text-label-caps border"
                        style={{
                          backgroundColor: `${siteColor}18`,
                          color: siteColor,
                          borderColor: `${siteColor}35`,
                        }}
                      >
                        {site?.code || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                        <span className="text-body-sm text-on-surface capitalize">{drone.simulation_status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-data-mono text-on-surface-variant">{drone.heading}°</td>
                    <td className="px-6 py-4 text-data-mono text-on-surface-variant">{drone.speed_mps} <span className="text-[10px] opacity-50">m/s</span></td>
                    <td className="px-6 py-4 text-data-mono text-on-surface-variant">{drone.last_confirmed_altitude} <span className="text-[10px] opacity-50">m</span></td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2 py-0.5 text-label-caps border"
                        style={{
                          backgroundColor: `${freshness.color}15`,
                          color: freshness.color,
                          borderColor: `${freshness.color}25`,
                        }}
                      >
                        {freshness.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="text-primary hover:underline text-label-caps mr-4"
                        onClick={(e) => { e.stopPropagation(); setSelectedDrone(drone) }}
                      >
                        View
                      </button>
                      <button className="text-on-surface-variant hover:text-on-surface material-symbols-outlined text-[18px] align-middle">
                        more_vert
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Drone Detail Panel */}
      <DroneDetailPanel
        isOpen={!!selectedDrone}
        onClose={() => setSelectedDrone(null)}
        drone={selectedDrone}
      />

      {/* Add Drone Modal */}
      <AddDroneModal isOpen={showAddDrone} onClose={() => setShowAddDrone(false)} />
    </PageLayout>
  )
}
