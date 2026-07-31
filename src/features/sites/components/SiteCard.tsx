import { useState } from 'react'
import type { Site, Drone } from '@/types'

interface SiteCardProps {
  site: Site
  droneCount?: number
  assignedDrones?: Drone[]
  onSelect?: (site: Site) => void
}

export function SiteCard({ site, droneCount = 0, assignedDrones = [], onSelect }: SiteCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="bg-surface-container border border-outline-variant hover:bg-surface-container-high transition-colors cursor-pointer"
      onClick={() => {
        setExpanded(!expanded)
        onSelect?.(site)
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: site.color }} />
            <div>
              <h3 className="text-label-caps text-on-surface">{site.code}</h3>
              <p className="text-headline-md text-on-surface">{site.name}</p>
            </div>
          </div>
          <span
            className={`text-label-caps px-2 py-0.5 border ${
              site.is_active
                ? 'text-[#27AE60] bg-[#27AE60]/10 border-[#27AE60]/20'
                : 'text-outline bg-surface-variant/30 border-outline-variant'
            }`}
          >
            {site.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface p-3 border border-outline-variant">
            <p className="text-label-caps text-outline">DRONES</p>
            <p className="text-data-mono text-on-surface text-lg">{droneCount}</p>
          </div>
          <div className="bg-surface p-3 border border-outline-variant">
            <p className="text-label-caps text-outline">RADIUS</p>
            <p className="text-data-mono text-on-surface text-lg">{site.radius_km} km</p>
          </div>
        </div>

        <div className="mt-3 bg-surface p-3 border border-outline-variant">
          <p className="text-label-caps text-outline mb-1">COORDINATES</p>
          <div className="flex gap-4 text-data-mono text-on-surface-variant">
            <span>{site.latitude.toFixed(4)}° N</span>
            <span>{Math.abs(site.longitude).toFixed(4)}° W</span>
          </div>
        </div>

        {site.description && (
          <p className="text-body-sm text-on-surface-variant mt-3">{site.description}</p>
        )}
      </div>

      {/* Expanded drone list */}
      {expanded && assignedDrones.length > 0 && (
        <div className="border-t border-outline-variant px-5 py-3">
          <p className="text-label-caps text-outline mb-2">ASSIGNED DRONES</p>
          <div className="space-y-1">
            {assignedDrones.map((drone) => (
              <div key={drone.id} className="flex items-center justify-between py-1.5 px-2 bg-surface/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm" style={{ color: site.color }}>airplanemode_active</span>
                  <span className="text-data-mono text-on-surface">{drone.drone_id}</span>
                </div>
                <div className="flex items-center gap-3 text-data-mono text-[10px] text-on-surface-variant">
                  <span>{drone.heading}°</span>
                  <span>{drone.speed_mps} m/s</span>
                  <span className="capitalize">{drone.simulation_status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && assignedDrones.length === 0 && (
        <div className="border-t border-outline-variant px-5 py-4 text-center">
          <p className="text-body-sm text-on-surface-variant">No drones assigned to this site.</p>
        </div>
      )}
    </div>
  )
}
