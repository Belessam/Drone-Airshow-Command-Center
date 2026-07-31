/**
 * TacticalCompassRing — a transparent military azimuth ring for the map overlay.
 *
 * Centered on a selected site, rotates with map bearing so N always points
 * toward true north. Shows:
 *   - Outer/inner concentric rings
 *   - Minor ticks every 10°
 *   - Major ticks every 30° with labels (N, 30, 60, E, ...)
 *   - Cardinal emphasis (N red, S dimmed)
 *
 * Designed to be subtle, premium, and not clutter the map.
 */

interface TacticalCompassRingProps {
  size?: number
  bearing?: number // map bearing in degrees, for true-north alignment
}

export function TacticalCompassRing({ size = 200, bearing = 0 }: TacticalCompassRingProps) {
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.46
  const innerR = size * 0.37
  const majorTickLen = size * 0.06
  const minorTickLen = size * 0.03
  const labelR = innerR - majorTickLen - size * 0.055

  const ticks: React.ReactNode[] = []

  for (let deg = 0; deg < 360; deg += 10) {
    const isMajor = deg % 30 === 0
    const isCardinal = deg % 90 === 0
    const tickLen = isMajor ? majorTickLen : minorTickLen
    const rad = ((deg - 90) * Math.PI) / 180

    const x1 = cx + Math.cos(rad) * innerR
    const y1 = cy + Math.sin(rad) * innerR
    const x2 = cx + Math.cos(rad) * (innerR - tickLen)
    const y2 = cy + Math.sin(rad) * (innerR - tickLen)

    const stroke = isCardinal
      ? (deg === 0 ? '#EF4444' : deg === 180 ? '#6b7280' : '#9ca3af')
      : isMajor
        ? '#6b7280'
        : '#4b5563'
    const strokeW = isCardinal ? 2.0 : isMajor ? 1.5 : 0.75

    ticks.push(
      <line
        key={`tick-${deg}`}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />,
    )
  }

  // Labels every 30°
  const labelAngles = [
    { deg: 0, label: 'N', isCardinal: true },
    { deg: 30, label: '30', isCardinal: false },
    { deg: 60, label: '60', isCardinal: false },
    { deg: 90, label: 'E', isCardinal: true },
    { deg: 120, label: '120', isCardinal: false },
    { deg: 150, label: '150', isCardinal: false },
    { deg: 180, label: 'S', isCardinal: true },
    { deg: 210, label: '210', isCardinal: false },
    { deg: 240, label: '240', isCardinal: false },
    { deg: 270, label: 'W', isCardinal: true },
    { deg: 300, label: '300', isCardinal: false },
    { deg: 330, label: '330', isCardinal: false },
  ]

  const labels = labelAngles.map(({ deg, label, isCardinal }) => {
    const rad = ((deg - 90) * Math.PI) / 180
    const lx = cx + Math.cos(rad) * labelR
    const ly = cy + Math.sin(rad) * labelR
    const isN = deg === 0
    const isS = deg === 180

    return (
      <text
        key={`label-${deg}`}
        x={lx} y={ly}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'JetBrains Mono', monospace"
        fontSize={isCardinal ? size * 0.075 : size * 0.055}
        fontWeight={isCardinal ? 800 : 500}
        fill={isN ? '#EF4444' : isS ? '#6b7280' : isCardinal ? '#9ca3af' : '#6b7280'}
        letterSpacing="0.02em"
      >
        {label}
      </text>
    )
  })

  // Cardinal small triangles at N position
  const northTriangle = (() => {
    const rad = ((-90) * Math.PI) / 180
    const tipR = outerR + 2
    const baseR = outerR + 8
    const tip = { x: cx + Math.cos(rad) * tipR, y: cy + Math.sin(rad) * tipR }
    const baseW = 5
    const b1 = { x: cx + Math.cos(rad) * baseR - baseW, y: cy + Math.sin(rad) * baseR }
    const b2 = { x: cx + Math.cos(rad) * baseR + baseW, y: cy + Math.sin(rad) * baseR }
    return (
      <polygon
        points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`}
        fill="#EF4444"
        opacity={0.7}
      />
    )
  })()

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="select-none"
      style={{
        filter: 'drop-shadow(0 0 12px rgba(0,0,0,0.6))',
        transform: `rotate(${bearing}deg)`,
        transition: 'transform 0.1s ease-out',
      }}
    >
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {/* Inner ring */}
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

      {/* Tick marks */}
      {ticks}

      {/* Labels */}
      {labels}

      {/* North indicator triangle */}
      {northTriangle}

      {/* Center crosshair */}
      <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={2} fill="rgba(255,255,255,0.2)" />
    </svg>
  )
}
