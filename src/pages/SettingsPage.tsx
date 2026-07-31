import { useState } from 'react'
import { PageLayout } from '@/layouts/PageLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function SettingsPage() {
  const [freshThreshold, setFreshThreshold] = useState(120)
  const [recentThreshold, setRecentThreshold] = useState(300)
  const [staleThreshold, setStaleThreshold] = useState(600)
  const [autoSimulation, setAutoSimulation] = useState(true)
  const [showTrails, setShowTrails] = useState(true)
  const [staleAlerts, setStaleAlerts] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <PageLayout title="Settings">
      <div className="p-6 max-w-3xl space-y-6">
        {/* Freshness Thresholds */}
        <Card className="p-6">
          <h3 className="text-label-caps text-outline mb-1">Freshness Thresholds</h3>
          <p className="text-body-sm text-on-surface-variant mb-4">
            Configure data freshness classification time windows.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Fresh (seconds)</label>
              <input
                className="w-full bg-surface border border-outline-variant text-on-surface px-3 py-2 text-body-sm outline-none focus:border-primary"
                type="number"
                min={10}
                value={freshThreshold}
                onChange={(e) => setFreshThreshold(Number(e.target.value))}
              />
              <p className="text-[10px] text-outline mt-1">&lt; {Math.round(freshThreshold / 60)} min → Fresh</p>
            </div>
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Recent (seconds)</label>
              <input
                className="w-full bg-surface border border-outline-variant text-on-surface px-3 py-2 text-body-sm outline-none focus:border-primary"
                type="number"
                min={10}
                value={recentThreshold}
                onChange={(e) => setRecentThreshold(Number(e.target.value))}
              />
              <p className="text-[10px] text-outline mt-1">&lt; {Math.round(recentThreshold / 60)} min → Recent</p>
            </div>
            <div>
              <label className="text-label-caps text-on-surface-variant block mb-2">Stale (seconds)</label>
              <input
                className="w-full bg-surface border border-outline-variant text-on-surface px-3 py-2 text-body-sm outline-none focus:border-primary"
                type="number"
                min={10}
                value={staleThreshold}
                onChange={(e) => setStaleThreshold(Number(e.target.value))}
              />
              <p className="text-[10px] text-outline mt-1">&gt; {Math.round(staleThreshold / 60)} min → Critical</p>
            </div>
          </div>
        </Card>

        {/* System Configuration */}
        <Card className="p-6">
          <h3 className="text-label-caps text-outline mb-1">System Configuration</h3>
          <p className="text-body-sm text-on-surface-variant mb-4">Configure application behavior.</p>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 bg-surface border border-outline-variant cursor-pointer hover:bg-surface-container-low transition-colors">
              <div>
                <p className="text-body-sm text-on-surface font-medium">Auto-start simulation on drone creation</p>
                <p className="text-body-sm text-on-surface-variant">Simulation automatically begins when a new drone is registered.</p>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 bg-surface border-outline-variant text-primary rounded-none"
                checked={autoSimulation}
                onChange={(e) => setAutoSimulation(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-surface border border-outline-variant cursor-pointer hover:bg-surface-container-low transition-colors">
              <div>
                <p className="text-body-sm text-on-surface font-medium">Show historical trails on map</p>
                <p className="text-body-sm text-on-surface-variant">Display past simulation segments as dashed trails on the map.</p>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 bg-surface border-outline-variant text-primary rounded-none"
                checked={showTrails}
                onChange={(e) => setShowTrails(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-surface border border-outline-variant cursor-pointer hover:bg-surface-container-low transition-colors">
              <div>
                <p className="text-body-sm text-on-surface font-medium">Enable stale data alerts</p>
                <p className="text-body-sm text-on-surface-variant">Warn when a drone has not sent an update within the stale threshold.</p>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 bg-surface border-outline-variant text-primary rounded-none"
                checked={staleAlerts}
                onChange={(e) => setStaleAlerts(e.target.checked)}
              />
            </label>
          </div>
        </Card>

        {/* Save */}
        <div className="flex items-center gap-4">
          <Button variant="primary" icon="save" onClick={handleSave}>
            Save Settings
          </Button>
          {saved && (
            <span className="text-data-mono text-[#27AE60] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              Settings saved successfully.
            </span>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
