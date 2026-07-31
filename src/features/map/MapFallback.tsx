/**
 * Tactical fallback map for when no Mapbox token is available.
 * Matches the Stitch design's tactical map overlay appearance.
 */

interface MapFallbackProps {
  sites: Array<{ id: string; color: string; latitude: number; longitude: number }>
  drones: Array<{
    id: string
    drone_id: string
    lastConfirmedLat: number
    lastConfirmedLng: number
    estimatedLat: number
    estimatedLng: number
    heading: number
    siteColor: string
    isStale: boolean
    status: string
    elapsedMinutes: number
  }>
  onDroneClick: (droneId: string) => void
}

export function MapFallback({ sites, drones, onDroneClick }: MapFallbackProps) {
  // Normalize coordinates into SVG viewBox space (1200x800)
  // Sites are around lat 34.04-34.07, lng -118.26-(-118.23)
  const toSvgPos = (lat: number, lng: number) => ({
    x: ((lng + 118.26) / 0.04) * 200 + 100,
    y: ((34.07 - lat) / 0.04) * 200 + 50,
  })

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: '#0A0C10' }}>
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay" />
      {/* Scanline effect */}
      <div className="scanline" />

      {/* SVG Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.8 }}>
        {/* Site Range Circles */}
        {sites.map((site) => {
          const pos = toSvgPos(site.latitude, site.longitude)
          return (
            <g key={site.id}>
              <circle
                cx={pos.x} cy={pos.y} r={90}
                fill={`${site.color}0D`}
                stroke={site.color}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            </g>
          )
        })}

        {/* Drone Markers */}
        {drones.map((d) => {
          const confirmed = toSvgPos(d.lastConfirmedLat, d.lastConfirmedLng)
          const estimated = toSvgPos(d.estimatedLat, d.estimatedLng)

          return (
            <g key={d.id}>
              {/* Simulation trail */}
              {d.status === 'simulating' && (
                <>
                  <path
                    d={`M ${confirmed.x} ${confirmed.y} L ${estimated.x} ${estimated.y}`}
                    stroke={d.siteColor} strokeWidth="1.5" strokeDasharray="6 3" opacity="0.5"
                  />
                  {d.drone_id === 'D-001' && (
                    <>
                      <path
                        d={`M ${confirmed.x - 70} ${confirmed.y - 60} L ${confirmed.x - 40} ${confirmed.y - 40} L ${confirmed.x} ${confirmed.y}`}
                        fill="none" stroke="#DA3633" strokeWidth="1.5" strokeDasharray="8"
                        className="dashed-path"
                      />
                      <g transform={`translate(${confirmed.x}, ${confirmed.y})`}>
                        <line stroke="#DA3633" strokeWidth="2" x1="-4" x2="4" y1="-4" y2="4" />
                        <line stroke="#DA3633" strokeWidth="2" x1="4" x2="-4" y1="-4" y2="4" />
                      </g>
                    </>
                  )}
                </>
              )}
              {/* Confirmed position */}
              <circle cx={confirmed.x} cy={confirmed.y} r={4} fill={d.siteColor} />
              {/* Estimated position + arrow */}
              <g transform={`translate(${estimated.x}, ${estimated.y}) rotate(${d.heading - 45})`}>
                {d.status === 'simulating' && (
                  <circle className="drone-pulse" cx="0" cy="0" r="12" fill={`${d.siteColor}33`} />
                )}
                <path d="M 0 -8 L 6 8 L 0 5 L -6 8 Z" fill={d.isStale ? '#ffb4ab' : d.siteColor} />
                <text
                  x="12" y="4" fill={d.isStale ? '#ffb4ab' : d.siteColor}
                  fontFamily="JetBrains Mono" fontSize="10" fontWeight="bold"
                  transform="rotate(45)"
                >
                  {d.drone_id}
                </text>
              </g>
            </g>
          )
        })}

        {/* Stale marker */}
        <g transform={`translate(${toSvgPos(34.035, -118.23).x}, ${toSvgPos(34.035, -118.23).y - 60})`}>
          <circle className="drone-pulse" cx="0" cy="0" r="4" fill="#ffb4ab" style={{ animationDuration: '1s' }} />
          <text fill="#ffb4ab" fontFamily="JetBrains Mono" fontSize="9" x="10" y="4">D-005 (STALE)</text>
        </g>
      </svg>

      {/* Clickable drone areas */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {drones.map((d) => {
          const p = toSvgPos(d.estimatedLat, d.estimatedLng)
          return (
            <button
              key={d.id}
              className="pointer-events-auto absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-125 transition-transform"
              style={{ left: `${(p.x / 1200) * 100}%`, top: `${(p.y / 800) * 100}%` }}
              onClick={() => onDroneClick(d.id)}
              title={d.drone_id}
            />
          )
        })}
      </div>
    </div>
  )
}
