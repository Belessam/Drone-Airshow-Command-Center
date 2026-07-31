/**
 * DroneMarker — creates the marker HTML element for MapLibre map markers.
 * Uses an inline SVG string for the drone/aircraft top-down silhouette.
 */

/**
 * Build an SVG string for a drone marker with the given properties.
 */
export function createDroneMarkerSvg(
  size: number,
  color: string,
  heading: number,
  isStale: boolean,
  isSelected: boolean,
): string {
  const s = size
  const c = s / 2
  const fillColor = isStale ? '#ffb4ab' : color
  const strokeColor = isSelected ? '#ffffff' : 'rgba(0,0,0,0.3)'

  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="transform:rotate(${heading}deg);display:block;" xmlns="http://www.w3.org/2000/svg">
    ${isSelected ? `<circle cx="${c}" cy="${c}" r="${s * 0.42}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" opacity="0.5"/>` : ''}
    ${!isStale ? `<circle cx="${c}" cy="${c}" r="${s * 0.35}" fill="${fillColor}" opacity="0.15" class="drone-pulse-marker"/>` : ''}
    <g transform="translate(${c}, ${c})">
      <path d="M 0,-10 L 2,-8 L 3,2 L 6,6 L 5,8 L 2,6 L 1,3 L -1,3 L -2,6 L -5,8 L -6,6 L -3,2 L -2,-8 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.5"/>
      <path d="M -10,-3 L -3,-1 L -3,1 L -10,3 Z M 10,-3 L 3,-1 L 3,1 L 10,3 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.3"/>
      <path d="M -3,-8 L 3,-8 L 2,-5 L -2,-5 Z" fill="${fillColor}" opacity="0.8"/>
      <circle cx="0" cy="0" r="1.5" fill="#ffffff" opacity="0.6"/>
    </g>
  </svg>`
}

/**
 * Creates an HTML element for a MapLibre map marker with the drone SVG.
 */
export function createDroneMarkerElement(
  droneId: string,
  color: string,
  heading: number,
  isStale: boolean,
  isSelected: boolean,
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'drone-map-marker'
  el.style.cssText = `width:36px;height:36px;cursor:pointer;position:relative;${
    isSelected ? 'z-index:100;filter:brightness(1.2) drop-shadow(0 0 8px rgba(255,255,255,0.4));' : 'z-index:10;'
  }`

  const svgString = createDroneMarkerSvg(36, color, heading, isStale, isSelected)
  el.innerHTML = svgString

  // Drone ID label
  const label = document.createElement('span')
  label.style.cssText = `position:absolute;left:38px;top:6px;color:${isStale ? '#ffb4ab' : color};font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;white-space:nowrap;pointer-events:none;text-shadow:0 0 4px rgba(0,0,0,0.9);`
  label.textContent = droneId
  el.appendChild(label)

  return el
}
