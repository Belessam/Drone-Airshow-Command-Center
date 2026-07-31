/**
 * CoverageDiagnostics — development-only dashboard showing per-provider metrics,
 * Hafar Al Batin coverage, and per-site coverage.
 *
 * Only rendered in dev mode or when ?diagnostics=true
 */

import type { ProviderMetrics, MergeDiagnostics, HabCoverageDiagnostics, SiteCoverageDiagnosticsEntry } from '@/features/aircraft/types'

interface DiagnosticsPanelProps {
  providerMetrics: Record<string, ProviderMetrics>
  mergeDiagnostics: MergeDiagnostics | null
  habDiagnostics: HabCoverageDiagnostics | null
  siteDiagnostics: SiteCoverageDiagnosticsEntry[]
}

function ProviderRow({ name, metrics }: { name: string; metrics: ProviderMetrics }) {
  const statusColor =
    metrics.status === 'ok' ? '#34D399'
    : metrics.status === 'rate_limited' ? '#F2994A'
    : metrics.status === 'error' ? '#EF4444'
    : '#6b7280'

  const lastUpdateStr = metrics.lastUpdate
    ? new Date(metrics.lastUpdate).toLocaleTimeString()
    : '—'

  return (
    <tr className="border-b border-outline-variant/30 text-data-mono text-[10px]">
      <td className="py-1.5 pr-3 text-on-surface font-bold">{name}</td>
      <td className="py-1.5 px-2 text-right text-on-surface-variant">{metrics.rawAircraft}</td>
      <td className="py-1.5 px-2 text-right text-on-surface-variant">{metrics.uniqueAircraft}</td>
      <td className="py-1.5 px-2 text-right text-outline">{Math.max(0, metrics.rawAircraft - metrics.uniqueAircraft)}</td>
      <td className="py-1.5 px-2 text-right text-[#56CCF2]">{metrics.newUniqueAircraft}</td>
      <td className="py-1.5 px-2 text-right text-[#F2994A]">{metrics.saudiCount}</td>
      <td className="py-1.5 px-2 text-right text-[#EF4444]">{metrics.militaryCount}</td>
      <td className="py-1.5 px-2 text-on-surface-variant">{lastUpdateStr}</td>
      <td className="py-1.5 pl-3">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: statusColor }}
          title={metrics.status}
        />
        <span className="ml-1" style={{ color: statusColor }}>{metrics.status}</span>
      </td>
    </tr>
  )
}

export function CoverageDiagnostics({ providerMetrics, mergeDiagnostics, habDiagnostics, siteDiagnostics }: DiagnosticsPanelProps) {
  if (!mergeDiagnostics) return null

  return (
    <div className="absolute top-16 left-4 z-40 bg-surface-container/95 border border-outline-variant shadow-xl max-w-[900px] max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="p-2.5 border-b border-outline-variant bg-surface-container-high">
        <span className="text-label-caps text-[10px] text-[#56CCF2] font-bold">
          COVERAGE DIAGNOSTICS
        </span>
        <button
          onClick={() => {
            // Dynamically import and run the HAB debug
            import('@/features/aircraft/hab-debug').then(m => m.runHabDebug())
          }}
          className="ml-2 text-label-caps text-[10px] text-[#EF4444] border border-[#EF4444] px-2 py-0.5 hover:bg-[#EF4444]/10"
          title="Run HAB Debug — tests all providers for aircraft near Hafar Al Batin"
        >
          HAB DEBUG
        </button>
      </div>

      {/* ── Provider table ── */}
      <div className="overflow-x-auto p-2">
        <table className="w-full">
          <thead>
            <tr className="text-label-caps text-[9px] text-outline border-b border-outline-variant/40">
              <th className="text-left py-1 pr-3">Provider</th>
              <th className="text-right py-1 px-2">Raw</th>
              <th className="text-right py-1 px-2">Unique</th>
              <th className="text-right py-1 px-2">Dups</th>
              <th className="text-right py-1 px-2">New Unique</th>
              <th className="text-right py-1 px-2">Saudi</th>
              <th className="text-right py-1 px-2">Military</th>
              <th className="text-left py-1 px-2">Last Update</th>
              <th className="text-left py-1 pl-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(providerMetrics).map(([name, metrics]) => (
              <ProviderRow key={name} name={name} metrics={metrics} />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Merge summary ── */}
      <div className="p-2.5 border-t border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-4 text-data-mono text-[9px]">
          <span className="text-outline">MERGE</span>
          <span className="text-on-surface-variant">
            <span className="text-on-surface font-bold">{mergeDiagnostics.providers}</span> providers
          </span>
          <span className="text-on-surface-variant">
            <span className="text-[#56CCF2] font-bold">{mergeDiagnostics.rawTotal}</span> raw
          </span>
          <span className="text-on-surface-variant">
            <span className="text-[#F2994A] font-bold">{mergeDiagnostics.duplicatesRemoved}</span> dups removed
          </span>
          <span className="text-on-surface-variant">
            <span className="text-[#34D399] font-bold">{mergeDiagnostics.finalUnique}</span> final
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#56CCF2]" />
            <span className="text-on-surface-variant">{mergeDiagnostics.civilian}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            <span className="text-on-surface-variant">{mergeDiagnostics.military}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F2994A]" />
            <span className="text-on-surface-variant">{mergeDiagnostics.unknown}</span>
          </span>
          <span className="text-on-surface-variant">
            <span className="text-[#8B5CF6] font-bold">{mergeDiagnostics.multiSourceCount}</span> multi-source
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* ── HAFAR AL BATIN COVERAGE ── */}
      {/* ════════════════════════════════════════════ */}
      {habDiagnostics && (
        <>
          <div className="p-2.5 border-t border-outline-variant bg-surface-container-high">
            <span className="text-label-caps text-[10px] text-[#EF4444] font-bold">
              HAFAR AL BATIN COVERAGE
            </span>
            <span className="text-data-mono text-[9px] text-on-surface-variant ml-2">
              Center: 28.4328°N, 45.9708°E | Priority Radius: {habDiagnostics.priorityRadiusNm}nm
            </span>
          </div>
          <div className="p-2">
            {/* Per-provider breakdown */}
            <div className="overflow-x-auto mb-1">
              <table className="w-full text-data-mono text-[9px]">
                <thead>
                  <tr className="text-outline border-b border-outline-variant/40">
                    <th className="text-left py-1 pr-2">Provider</th>
                    <th className="text-right py-1 px-2">Raw Count</th>
                    <th className="text-right py-1 px-2">Near HAB</th>
                    <th className="text-right py-1 px-2">Near HAB %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(habDiagnostics.perProviderRaw).map(([source, raw]) => {
                    const near = habDiagnostics.perProviderNearHab[source] ?? 0
                    const pct = raw > 0 ? ((near / raw) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={source} className="border-b border-outline-variant/20">
                        <td className="py-1 pr-2 text-on-surface font-bold">{source}</td>
                        <td className="text-right py-1 px-2 text-on-surface-variant">{raw}</td>
                        <td className="text-right py-1 px-2 text-[#EF4444]">{near}</td>
                        <td className="text-right py-1 px-2 text-outline">{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 text-data-mono text-[9px] pt-1 border-t border-outline-variant/30">
              <span className="text-on-surface-variant">
                After normalization: <span className="text-[#56CCF2] font-bold">{habDiagnostics.totalFinal}</span> total
              </span>
              <span className="text-on-surface-variant">
                Inside HAB radius: <span className="text-[#EF4444] font-bold">{habDiagnostics.aircraftInRadius}</span>
              </span>
              <span className="text-on-surface-variant">
                Displayed on map: <span className="text-[#34D399] font-bold">{habDiagnostics.aircraftInRadius}</span>
              </span>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* ── SITE COVERAGE ── */}
      {/* ════════════════════════════════════════════ */}
      {siteDiagnostics.length > 0 && (
        <>
          <div className="p-2.5 border-t border-outline-variant bg-surface-container-high">
            <span className="text-label-caps text-[10px] text-[#F2994A] font-bold">
              SITE LOCAL COVERAGE
            </span>
          </div>
          <div className="p-2">
            <div className="overflow-x-auto">
              <table className="w-full text-data-mono text-[9px]">
                <thead>
                  <tr className="text-outline border-b border-outline-variant/40">
                    <th className="text-left py-1 pr-2">Site</th>
                    <th className="text-left py-1 px-2">Center</th>
                    <th className="text-right py-1 px-2">Radius</th>
                    <th className="text-right py-1 px-2">Aircraft Near</th>
                  </tr>
                </thead>
                <tbody>
                  {siteDiagnostics.map(sd => (
                    <tr key={sd.code} className="border-b border-outline-variant/20">
                      <td className="py-1 pr-2 text-on-surface font-bold">{sd.code}</td>
                      <td className="py-1 px-2 text-on-surface-variant">
                        {sd.centerLat.toFixed(4)}°N, {sd.centerLon.toFixed(4)}°E
                      </td>
                      <td className="text-right py-1 px-2 text-on-surface-variant">{sd.radiusNm}nm</td>
                      <td className="text-right py-1 px-2 text-[#F2994A] font-bold">{sd.aircraftCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
