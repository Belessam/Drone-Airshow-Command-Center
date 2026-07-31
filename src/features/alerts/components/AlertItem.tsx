import { useState } from 'react'
import type { Alert } from '@/types'

interface AlertItemProps {
  alert: Alert
}

const severityConfig = {
  critical: { icon: 'error', bg: '#93000a20', border: '#ffb4ab', text: '#ffb4ab' },
  warning: { icon: 'warning', bg: '#F2994A20', border: '#F2994A', text: '#F2994A' },
  info: { icon: 'info', bg: '#abc7ff20', border: '#abc7ff', text: '#abc7ff' },
}

export function AlertItem({ alert }: AlertItemProps) {
  const [expanded, setExpanded] = useState(false)
  const config = severityConfig[alert.severity]

  return (
    <div
      className="border-l-4 p-4 cursor-pointer transition-colors hover:brightness-110"
      style={{ borderLeftColor: config.border, backgroundColor: config.bg }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined" style={{ color: config.text }}>
            {config.icon}
          </span>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-label-caps" style={{ color: config.text }}>
                {alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              {alert.drone_id && (
                <span className="text-label-caps text-on-surface-variant bg-surface-container-high px-2 py-0.5">
                  {alert.drone_id.toUpperCase()}
                </span>
              )}
            </div>
            <h3 className="text-body-base text-on-surface font-semibold mb-1">{alert.title}</h3>
            <p className="text-body-sm text-on-surface-variant">{alert.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-body-sm text-on-surface-variant">
            {Math.floor((Date.now() - new Date(alert.created_at).getTime()) / 60000)}m ago
          </span>
          {!alert.is_resolved && alert.severity !== 'info' && (
            <button
              className="text-primary text-label-caps hover:underline"
              onClick={(e) => { e.stopPropagation(); /* resolve in later phases */ }}
            >
              Resolve
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 ml-12 p-3 bg-surface/50 border border-outline-variant">
          <p className="text-label-caps text-outline text-[10px] mb-1">DETAILS</p>
          <div className="text-data-mono text-body-sm text-on-surface-variant space-y-0.5">
            <div className="flex justify-between">
              <span>Alert ID</span>
              <span className="text-on-surface">{alert.id.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>Severity</span>
              <span style={{ color: config.text }}>{alert.severity.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span className="text-on-surface">{new Date(alert.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
