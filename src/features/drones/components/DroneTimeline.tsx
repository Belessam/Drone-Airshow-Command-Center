import { mockEvents } from '@/utils/mockData'
import type { DroneEvent } from '@/types'

interface DroneTimelineProps {
  droneId: string
  limit?: number
}

const eventColors: Record<string, string> = {
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

export function DroneTimeline({ droneId, limit }: DroneTimelineProps) {
  const events = mockEvents
    .filter((e: DroneEvent) => e.drone_id === droneId)
    .sort((a: DroneEvent, b: DroneEvent) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit || 20)

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="material-symbols-outlined text-outline text-3xl block mb-2">history</span>
        <p className="text-body-sm text-on-surface-variant">No events recorded for this drone.</p>
      </div>
    )
  }

  return (
    <div className="relative pl-6 border-l border-outline-variant space-y-5">
      {events.map((event) => {
        const color = eventColors[event.event_type] || '#abc7ff'
        const isAlert = event.event_type === 'alert_triggered'

        return (
          <div key={event.id} className="relative">
            <div
              className="absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
              style={{
                backgroundColor: isAlert ? `${color}30` : color,
                borderColor: color,
              }}
            >
              {isAlert && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
            </div>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-label-caps text-on-surface font-bold" style={{ color }}>
                    {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-label-caps text-on-surface-variant">|</span>
                  <span className="text-label-caps text-on-surface-variant">{droneId}</span>
                </div>
                {event.data && Object.keys(event.data).length > 0 && (
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    {Object.entries(event.data).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-outline font-data-mono whitespace-nowrap">
                {new Date(event.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
