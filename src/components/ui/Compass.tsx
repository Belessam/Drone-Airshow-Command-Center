/**
 * Compass — a professional navigation/orientation indicator for the tactical map.
 * Shows all 8 cardinal/intercardinal directions with N emphasized in red.
 * Full 360° rotation support via CSS transform on parent.
 * Matches the existing dark tactical design.
 */

interface CompassProps {
  size?: number
}

export function Compass({ size = 100 }: CompassProps) {
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.46
  const innerR = size * 0.38

  const directions = [
    { label: 'N', angle: 0, isPrimary: true },
    { label: 'NE', angle: 45, isPrimary: false },
    { label: 'E', angle: 90, isPrimary: false },
    { label: 'SE', angle: 135, isPrimary: false },
    { label: 'S', angle: 180, isPrimary: false },
    { label: 'SW', angle: 225, isPrimary: false },
    { label: 'W', angle: 270, isPrimary: false },
    { label: 'NW', angle: 315, isPrimary: false },
  ]

  const tickLen = size * 0.07
  const labelR = innerR - tickLen - size * 0.07

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="select-none"
      style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
    >
      {/* Outer ring with gradient-like appearance */}
      <circle cx={cx} cy={cy} r={outerR} fill="#141820" stroke="#2a303a" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#3a4250" strokeWidth="0.75" />

      {/* Inner subtle ring */}
      <circle cx={cx} cy={cy} r={innerR - size * 0.03} fill="none" stroke="#232a34" strokeWidth="0.5" />

      {/* Degree ticks every 45° */}
      {directions.map((d) => {
        const rad = (d.angle * Math.PI) / 180
        const x1 = cx + Math.sin(rad) * innerR
        const y1 = cy - Math.cos(rad) * innerR
        const x2 = cx + Math.sin(rad) * (innerR - tickLen)
        const y2 = cy - Math.cos(rad) * (innerR - tickLen)
        return (
          <line
            key={`tick-${d.label}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={d.label === 'N' ? '#EF4444' : d.label === 'S' ? '#6b7280' : '#4b5563'}
            strokeWidth={d.label === 'N' ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        )
      })}

      {/* Direction labels */}
      {directions.map((d) => {
        const rad = (d.angle * Math.PI) / 180
        const lx = cx + Math.sin(rad) * labelR
        const ly = cy - Math.cos(rad) * labelR
        const isN = d.label === 'N'
        const isS = d.label === 'S'
        return (
          <text
            key={`label-${d.label}`}
            x={lx} y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Inter', 'Segoe UI', sans-serif"
            fontSize={isN ? size * 0.1 : size * 0.065}
            fontWeight={isN ? 800 : 600}
            fill={isN ? '#EF4444' : isS ? '#6b7280' : '#9ca3af'}
            letterSpacing="0.03em"
          >
            {d.label}
          </text>
        )
      })}

      {/* Minor tick marks every 15° between cardinals */}
      {[15, 30, 60, 75, 105, 120, 150, 165, 195, 210, 240, 255, 285, 300, 330, 345].map((angle) => {
        const rad = (angle * Math.PI) / 180
        const x1 = cx + Math.sin(rad) * innerR
        const y1 = cy - Math.cos(rad) * innerR
        const x2 = cx + Math.sin(rad) * (innerR - size * 0.025)
        const y2 = cy - Math.cos(rad) * (innerR - size * 0.025)
        return (
          <line
            key={`min-tick-${angle}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#374151"
            strokeWidth={0.75}
            strokeLinecap="round"
          />
        )
      })}

      {/* North indicator triangle above N */}
      <polygon
        points={`${cx},${cy - outerR + 4} ${cx - 4},${cy - outerR + 12} ${cx + 4},${cy - outerR + 12}`}
        fill="#EF4444"
        opacity="0.9"
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={size * 0.035} fill="#EF4444" opacity="0.7" />
      <circle cx={cx} cy={cy} r={size * 0.015} fill="#ffffff" opacity="0.9" />
    </svg>
  )
}
