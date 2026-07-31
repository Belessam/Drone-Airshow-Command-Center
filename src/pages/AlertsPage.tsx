import { useState } from 'react'
import { PageLayout } from '@/layouts/PageLayout'
import { AlertItem } from '@/features/alerts/components/AlertItem'
import { mockAlerts } from '@/utils/mockData'

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'

export function AlertsPage() {
  const [filter, setFilter] = useState<SeverityFilter>('all')

  const filtered = filter === 'all'
    ? mockAlerts
    : mockAlerts.filter((a) => a.severity === filter)

  const criticalCount = mockAlerts.filter((a) => a.severity === 'critical' && !a.is_resolved).length

  return (
    <PageLayout title="Alerts & Warnings">
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <ButtonGroup
            options={[
              { label: `All Alerts (${mockAlerts.length})`, value: 'all' },
              { label: `Critical (${mockAlerts.filter((a) => a.severity === 'critical').length})`, value: 'critical' },
              { label: 'Warnings', value: 'warning' },
              { label: 'Info', value: 'info' },
            ]}
            selected={filter}
            onSelect={(v) => setFilter(v as SeverityFilter)}
          />
        </div>

        {criticalCount > 0 && (
          <div className="bg-error-container/10 border border-error/30 p-3 mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-error">priority_high</span>
            <p className="text-body-sm text-on-error-container">
              {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} require immediate attention.
            </p>
          </div>
        )}

        <div className="bg-surface-container border border-outline-variant">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-outline text-4xl block mb-2">check_circle</span>
              <p className="text-body-sm text-on-surface-variant">No alerts found for this filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/30">
              {filtered.map((alert) => (
                <AlertItem key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

interface ButtonGroupProps {
  options: { label: string; value: string }[]
  selected: string
  onSelect: (value: string) => void
}

function ButtonGroup({ options, selected, onSelect }: ButtonGroupProps) {
  return (
    <div className="flex flex-wrap bg-surface-container border border-outline-variant p-0.5 w-full sm:w-auto">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`px-4 py-2 text-label-caps transition-all ${
            selected === opt.value
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
          onClick={() => onSelect(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
