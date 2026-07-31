import { useState } from 'react'
import { PageLayout } from '@/layouts/PageLayout'
import { Card } from '@/components/ui/Card'
import { mockEvents, mockSites, mockDrones } from '@/utils/mockData'
import type { DroneEvent } from '@/types'

const eventTypeColors: Record<string, string> = {
  drone_created: '#27AE60',
  drone_updated: '#F2994A',
  simulation_started: '#2F80ED',
  simulation_ended: '#EB5757',
  heading_changed: '#9B51E0',
  speed_changed: '#56CCF2',
  altitude_changed: '#56CCF2',
  alert_triggered: '#EB5757',
  alert_resolved: '#27AE60',
}

export function HistoryPage() {
  const [droneFilter, setDroneFilter] = useState('All Drones')
  const [search, setSearch] = useState('')

  const events = [...mockEvents]
    .filter((e: DroneEvent) => {
      if (droneFilter !== 'All Drones' && e.drone_id !== droneFilter.toLowerCase().replace('-', '')) return false
      if (search && !e.event_type.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a: DroneEvent, b: DroneEvent) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <PageLayout title="Mission History">
      <div className="p-6">
        <p className="text-body-sm text-on-surface-variant mb-6">
          Complete event log for all drone operations and system actions.
        </p>

        <Card>
          {/* Filters */}
          <div className="p-4 border-b border-outline-variant flex gap-4 flex-wrap">
            <div className="relative">
              <input
                className="bg-surface text-on-surface border border-outline-variant pl-10 pr-4 py-2 text-body-sm w-64 focus:border-primary outline-none"
                placeholder="Search events..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">search</span>
            </div>
            <select
              className="bg-surface text-on-surface border border-outline-variant px-3 py-2 text-body-sm focus:border-primary outline-none"
              value={droneFilter}
              onChange={(e) => setDroneFilter(e.target.value)}
            >
              <option>All Drones</option>
              {mockDrones.map((d) => (
                <option key={d.id}>{d.drone_id}</option>
              ))}
            </select>
          </div>

          {/* Timeline */}
          <div className="p-4">
            {events.length === 0 ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-outline text-3xl block mb-2">history_toggle_off</span>
                <p className="text-body-sm text-on-surface-variant">No events match your filters.</p>
              </div>
            ) : (
              <div className="relative pl-6 border-l border-outline-variant space-y-5">
                {events.map((event) => {
                  const color = eventTypeColors[event.event_type] || '#abc7ff'
                  const site = event.site_id ? mockSites.find((s) => s.id === event.site_id) : null
                  const drone = mockDrones.find((d) => d.id === event.drone_id)

                  return (
                    <div key={event.id} className="relative">
                      <div
                        className="absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2"
                        style={{
                          backgroundColor: color,
                          borderColor: color,
                        }}
                      />
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-label-caps text-on-surface font-bold" style={{ color }}>
                              {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                            <span className="text-label-caps text-on-surface-variant">|</span>
                            <span className="text-label-caps text-on-surface-variant">{drone?.drone_id || event.drone_id}</span>
                          </div>
                          {event.data && Object.keys(event.data).length > 0 && (
                            <p className="text-body-sm text-on-surface-variant mt-1">
                              {Object.entries(event.data).map(([k, v]) =>
                                `${k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}: ${v}`
                              ).join(' · ')}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            {site && (
                              <span className="text-[10px] text-outline font-data-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: site.color }} />
                                {site.code}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-outline font-data-mono whitespace-nowrap">
                          {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}
