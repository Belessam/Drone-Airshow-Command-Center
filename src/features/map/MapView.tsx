/**
 * MapView — renders a REAL dark geographic map using MapLibre GL JS.
 *
 * CRITICAL RULES:
 * - MapLibre uses [longitude, latitude] order
 * - All bearing calculations are SITE-RELATIVE (selected site → mouse)
 * - NO map-center bearings. NO global headings.
 * - Each entity = EXACTLY ONE marker, keyed by unique id
 */

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { calculateBearing, calculateDistance } from '@/lib/simulation/engine'
import { simulationRunner } from '@/lib/simulation/runner'
import * as mgrs from 'mgrs'

interface DroneMarker {
  id: string; drone_id: string; latitude: number; longitude: number
  heading: number; siteColor: string; isStale: boolean
  simulationStatus: string; sourceSiteId: string
}

interface SiteMarker {
  id: string; latitude: number; longitude: number
  color: string; name: string; code: string
}

interface AircraftMarker {
  id: string
  callsign?: string
  latitude: number
  longitude: number
  altitude?: number
  speed?: number
  heading?: number
  aircraftType?: string
  registration?: string
  classification: 'civilian' | 'military' | 'unknown'
  source?: string
}

interface MapViewProps {
  drones: DroneMarker[]; sites: SiteMarker[]
  aircraft?: AircraftMarker[]
  showAircraft?: boolean
  onDroneClick: (droneId: string) => void
  onAircraftClick?: (aircraft: AircraftMarker) => void
  selectedDroneId?: string | null
  focusLatitude?: number; focusLongitude?: number; focusKey?: number
  onSiteClick?: (siteId: string) => void
  selectedSiteId?: string | null
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

const TILES = 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'

function bLabel(d: number): string {
  return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d / 22.5) % 16]
}

/**
 * Build a site marker element.
 * The container is 48×48 with anchor:center — geographic coordinate pins at (24,24).
 * All children are centered at (24,24) using flexbox centering on the container.
 * NO box-shadow, NO transform animations — these cause sub-pixel drift during zoom.
 */
function buildSiteMarkerEl(site: SiteMarker, selected: boolean): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `width:48px;height:48px;display:flex;align-items:center;justify-content:center;cursor:pointer;`
  // Glow ring — 30px (reduced from 36px)
  const g = document.createElement('div')
  g.style.cssText = `width:30px;height:30px;border-radius:50%;background:${site.color}22;border:${selected?'3':'2'}px solid ${site.color};position:absolute;`
  // Inner dot — 7px (reduced from 9px)
  const dot = document.createElement('div')
  dot.style.cssText = `width:7px;height:7px;border-radius:50%;background:${site.color};border:2px solid rgba(255,255,255,0.6);position:absolute;`
  // White debug dot at exact center
  const dd = document.createElement('div')
  dd.style.cssText = `width:4px;height:4px;border-radius:50%;background:#fff;position:absolute;pointer-events:none;z-index:999;`
  // Label to the right of the marker
  const lb = document.createElement('div')
  lb.style.cssText = `position:absolute;left:28px;top:19px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:bold;color:${site.color};white-space:nowrap;text-shadow:0 0 6px rgba(0,0,0,0.9);pointer-events:none;letter-spacing:0.03em;line-height:14px;`
  lb.textContent = site.code
  el.append(dd, g, dot, lb)
  return el
}

/** Build the tactical compass ring SVG as an inline string for MapLibre Marker use */
function ringSVGContent(): string {
  const size = 200; const cx = 100; const cy = 100; const outerR = 92; const innerR = 74; const majorTickLen = 12; const minorTickLen = 6; const labelR = 56
  let lines = ''
  for (let deg = 0; deg < 360; deg += 10) {
    const isMajor = deg % 30 === 0; const isCardinal = deg % 90 === 0; const tickLen = isMajor ? majorTickLen : minorTickLen
    const rad = ((deg - 90) * Math.PI) / 180
    const x1 = (cx + Math.cos(rad) * innerR).toFixed(1); const y1 = (cy + Math.sin(rad) * innerR).toFixed(1)
    const x2 = (cx + Math.cos(rad) * (innerR - tickLen)).toFixed(1); const y2 = (cy + Math.sin(rad) * (innerR - tickLen)).toFixed(1)
    const stroke = isCardinal ? (deg === 0 ? '#EF4444' : deg === 180 ? '#6b7280' : '#9ca3af') : isMajor ? '#6b7280' : '#4b5563'
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${isCardinal ? 2 : isMajor ? 1.5 : 0.75}" stroke-linecap="round"/>`
  }
  const labels = [
    [0,'N',true],[30,'30'],[60,'60'],[90,'E',true],[120,'120'],[150,'150'],[180,'S',true],[210,'210'],[240,'240'],[270,'W',true],[300,'300'],[330,'330']
  ].map(([deg, label, isCardinal]) => {
    const rad = ((deg as number - 90) * Math.PI) / 180
    const lx = (cx + Math.cos(rad) * labelR).toFixed(1); const ly = (cy + Math.sin(rad) * labelR).toFixed(1)
    const isN = deg === 0; const isS = deg === 180
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" font-family="'JetBrains Mono',monospace" font-size="${isCardinal ? 15 : 11}" font-weight="${isCardinal ? 800 : 500}" fill="${isN ? '#EF4444' : isS ? '#6b7280' : isCardinal ? '#9ca3af' : '#6b7280'}" letter-spacing="0.02em">${label}</text>`
  }).join('')
  return `
    <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
    ${lines}
    ${labels}
    <polygon points="100,6 96,20 104,20" fill="#EF4444" opacity="0.7"/>
    <line x1="96" y1="100" x2="104" y2="100" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
    <line x1="100" y1="96" x2="100" y2="104" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
    <circle cx="100" cy="100" r="2" fill="rgba(255,255,255,0.2)"/>
  `
}

/**
 * Update an existing marker's visual state — color, code, label, and selection.
 * Called on every render when site data changes so edits appear immediately.
 * The marker element has known child structure: [debug dot, glow ring, inner dot, label]
 * as appended in buildSiteMarkerEl().
 */
function updateSiteMarkerDOM(marker: maplibregl.Marker, site: SiteMarker, selected: boolean): void {
  const el = marker.getElement()
  const children = el.children
  // children[0] = debug dot, children[1] = glow ring, children[2] = inner dot, children[3] = label
  if (children.length >= 4) {
    const ring = children[1] as HTMLElement
    const dot = children[2] as HTMLElement
    const label = children[3] as HTMLElement
    ring.style.background = site.color + '22'
    ring.style.border = `${selected ? 3 : 2}px solid ${site.color}`
    dot.style.background = site.color
    label.style.color = site.color
    label.textContent = site.code
  }
  marker.setLngLat([site.longitude, site.latitude])
}

/**
 * Build ONLY the SVG string for a drone icon — no wrapper element, no CSS.
 * Used to hot-swap the icon without touching the marker's style.
 */
function buildDroneSVG(id: string, c: string, h: number, stale: boolean, sel: boolean, hl: boolean): string {
  const fill = stale ? '#ffb4ab' : c
  const stk = sel ? '#ffffff' : 'rgba(0,0,0,0.3)'
  const sr = sel ? `<circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" opacity="0.5"/>` : ''
  const pb = !stale ? `<circle cx="18" cy="18" r="12" fill="${fill}" opacity="0.15" class="drone-pulse-marker"/>` : ''
  const gl = hl && !sel ? `<circle cx="18" cy="18" r="14" fill="none" stroke="${fill}" stroke-width="1.5" opacity="0.4"/>` : ''
  return `<svg width="36" height="36" viewBox="0 0 36 36" style="transform:rotate(${h}deg);display:block;" xmlns="http://www.w3.org/2000/svg">${sr}${gl}${pb}<g transform="translate(18,18)"><path d="M 0,-10 L 2,-8 L 3,2 L 6,6 L 5,8 L 2,6 L 1,3 L -1,3 L -2,6 L -5,8 L -6,6 L -3,2 L -2,-8 Z" fill="${fill}" stroke="${stk}" stroke-width="0.5"/><path d="M -10,-3 L -3,-1 L -3,1 L -10,3 Z M 10,-3 L 3,-1 L 3,1 L 10,3 Z" fill="${fill}" stroke="${stk}" stroke-width="0.3"/><path d="M -3,-8 L 3,-8 L 2,-5 L -2,-5 Z" fill="${fill}" opacity="0.8"/><circle cx="0" cy="0" r="1.5" fill="#fff" opacity="0.6"/></g></svg>`
}

function buildDroneEl(id: string, c: string, h: number, stale: boolean, sel: boolean, hl: boolean): HTMLDivElement {
  const fill = stale ? '#ffb4ab' : c
  const svg = buildDroneSVG(id, c, h, stale, sel, hl)
  // Same approach as site markers: flexbox centering, no manual pixel offsets.
  // Container is 48×48 with anchor:center — geographic coordinate pins at (24,24).
  const el = document.createElement('div')
  el.style.cssText = `width:48px;height:48px;display:flex;align-items:center;justify-content:center;cursor:pointer;${sel ? 'z-index:100;' : 'z-index:10;'}`
  // SVG wrapper — flexbox centers it naturally
  const sw = document.createElement('div'); sw.style.cssText = `width:36px;height:36px;pointer-events:none;`; sw.innerHTML = svg; el.appendChild(sw)
  // Label to the right
  const lb = document.createElement('span'); lb.style.cssText = `position:absolute;left:28px;top:19px;color:${stale ? '#ffb4ab' : c};font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:bold;white-space:nowrap;pointer-events:none;text-shadow:0 0 4px rgba(0,0,0,0.9);line-height:14px;`; lb.textContent = id; lb.setAttribute('data-label', ''); el.appendChild(lb)
  // Debug dot at exact center
  const dd = document.createElement('div'); dd.style.cssText = `width:3px;height:3px;border-radius:50%;background:#fff;position:absolute;pointer-events:none;z-index:999;box-shadow:0 0 3px #fff;`; dd.setAttribute('data-debug', ''); el.appendChild(dd)
  return el
}

/**
 * Build an aircraft marker element with classification-based coloring.
 *   civilian → cyan (#56CCF2)
 *   military → red (#EF4444)
 *   unknown  → amber (#F2994A)
 * Container is 40×40 with anchor:center — same positioning approach as sites/drones.
 */
function buildAircraftEl(ac: AircraftMarker): HTMLDivElement {
  const h = ac.heading ?? 0
  const color = ac.classification === 'military' ? '#EF4444'
    : ac.classification === 'civilian' ? '#56CCF2'
    : '#F2994A'
  const labelColor = ac.classification === 'military' ? '#EF4444'
    : ac.classification === 'civilian' ? '#56CCF2'
    : '#F2994A'
  const el = document.createElement('div')
  el.style.cssText = 'width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;'
  el.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" style="transform:rotate(${h}deg);display:block;" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(16,16)">
      <path d="M 0,-14 L 3,-10 L 4,0 L 12,4 L 12,7 L 5,5 L 3,12 L 6,15 L 5,16 L 0,14 L -5,16 L -6,15 L -3,12 L -5,5 L -12,7 L -12,4 L -4,0 L -3,-10 Z"
        fill="${color}" stroke="#0A0C10" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="0" cy="0" r="2" fill="#fff" opacity="0.5"/>
    </g>
  </svg>`
  if (ac.callsign) {
    const lb = document.createElement('div')
    lb.style.cssText = `position:absolute;left:50%;top:38px;transform:translateX(-50%);font-family:JetBrains Mono,monospace;font-size:8px;font-weight:bold;color:${labelColor};white-space:nowrap;pointer-events:none;text-shadow:0 0 4px rgba(0,0,0,0.9);letter-spacing:0.03em;line-height:12px;`
    lb.textContent = ac.callsign
    el.appendChild(lb)
  }
  return el
}

export function MapView({ drones, sites, aircraft, showAircraft = true, onDroneClick, onAircraftClick, selectedDroneId, focusLatitude, focusLongitude, focusKey, onSiteClick, selectedSiteId, isFullscreen, onToggleFullscreen }: MapViewProps) {
  const mcRef = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const dM = useRef<Map<string, maplibregl.Marker>>(new Map())
  const sM = useRef<Map<string, maplibregl.Marker>>(new Map())
  const aM = useRef<Map<string, maplibregl.Marker>>(new Map())
  const lineSrc = useRef<Set<string>>(new Set())
  const trailSrc = useRef<Set<string>>(new Set())
  const [ld, setLd] = useState(false)
  const init = useRef(false)

  // Mouse geo state — single object to prevent null/state timing issues
  const [mousePos, setMousePos] = useState<{ lat: number; lng: number } | null>(null)

  const [mapBearing, setMapBearing] = useState(0)
  const refSiteRef = useRef<{ latitude: number; longitude: number } | null>(null)
  /** Tracks the previously selected site ID to update old marker's visual state */
  const prevSelRef = useRef<string | null>(null)

  // Tactical ring — rendered as a MapLibre Marker for geo-anchoring
  const ringRef = useRef<maplibregl.Marker | null>(null)

  // Reference site
  const refSite = selectedSiteId ? sites.find(s => s.id === selectedSiteId) ?? null : null
  refSiteRef.current = refSite

  // ── MAP INIT ──
  useEffect(() => {
    if (init.current || !mcRef.current) return
    init.current = true
    const m = new maplibregl.Map({
      container: mcRef.current,
      style: {
        version: 8, name: 'Tactical Dark',
        sources: { 'carto-dark': { type: 'raster', tiles: [TILES], tileSize: 256, attribution: '' } },
        layers: [{ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 20 }],
      },
      center: [39.0, 26.5], zoom: 5, attributionControl: false,
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right')
    // Move nav controls up 48px to avoid overlap with bottom-right buttons
    const styleTag = document.createElement('style')
    styleTag.textContent = `.maplibregl-ctrl-bottom-right { bottom: 48px !important; }`
    styleTag.id = 'map-nav-offset'
    document.head.appendChild(styleTag)
    m.dragRotate.enable(); m.touchZoomRotate.enable()
    // Force custom black-red arrow cursor on map canvas
    const cursorStyle = document.createElement('style')
    cursorStyle.textContent = `.maplibregl-canvas { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpolygon points='10,2 6,18 10,14 14,18' fill='%23EF4444' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E") 10 4, default !important; }`
    cursorStyle.id = 'map-cursor-override'
    document.head.appendChild(cursorStyle)
    // Also apply directly to canvas after load
    m.on('load', () => {
      m.getCanvas().style.cursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpolygon points='10,2 6,18 10,14 14,18' fill='%23EF4444' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E") 10 4, default`
      setLd(true)
    })
    m.on('rotate', () => setMapBearing(m.getBearing()))
    m.on('mousemove', (e) => { setMousePos({ lat: e.lngLat.lat, lng: e.lngLat.lng }) })
    m.getCanvas().addEventListener('mouseleave', () => setMousePos(null))
    map.current = m
    const moveHandler = () => {
      if (!refSiteRef.current || !map.current) return
      // Ring is a MapLibre Marker — no manual screen-position update needed
    }
    m.on('move', moveHandler)
    m.on('zoom', moveHandler)
    m.on('resize', moveHandler)

    return () => {
      for (const tSrc of trailSrc.current) {
        try { if (m.getLayer(`${tSrc}-layer`)) m.removeLayer(`${tSrc}-layer`) } catch {}
        try { if (m.getSource(tSrc)) m.removeSource(tSrc) } catch {}
      }
      trailSrc.current.clear()
      m.remove(); map.current = null; dM.current.clear(); sM.current.clear(); aM.current.clear()
      init.current = false; document.getElementById('map-nav-offset')?.remove(); document.getElementById('map-cursor-override')?.remove()
      m.off('move', moveHandler); m.off('zoom', moveHandler); m.off('resize', moveHandler)
      if (ringRef.current) { ringRef.current.remove(); ringRef.current = null }
    }
  }, [])

  // ── FLY TO ──
  useEffect(() => { if (!map.current || !ld) return; if (focusLatitude !== undefined && focusLongitude !== undefined && focusKey) map.current.flyTo({ center: [focusLongitude, focusLatitude], zoom: 10, duration: 1200 }) }, [focusKey, focusLatitude, focusLongitude, ld])

  // ── RESIZE on fullscreen toggle ──
  // MapLibre must re-measure after the container reflows (chrome hidden or restored).
  useEffect(() => {
    if (!map.current || !ld) return
    const raf = requestAnimationFrame(() => map.current?.resize())
    return () => cancelAnimationFrame(raf)
  }, [isFullscreen, ld])

  // ── FIT — initial view only, skip if bounds are degenerate ──
  const fitted = useRef(false)
  useEffect(() => {
    if (!map.current || !ld || fitted.current) return
    const b = new maplibregl.LngLatBounds(); let pts = 0
    for (const s of sites) { if (typeof s.latitude === 'number' && !isNaN(s.latitude) && s.latitude !== 0 && s.longitude !== 0) { b.extend([s.longitude, s.latitude]); pts++ } }
    for (const d of drones) { if (typeof d.latitude === 'number' && !isNaN(d.latitude) && d.latitude !== 0 && d.longitude !== 0) { b.extend([d.longitude, d.latitude]); pts++ } }
    // Include Hafar Al Batin to ensure it's in the initial view
    b.extend([45.9708, 28.4328]); pts++
    if (pts >= 1 && sites.length > 0) {
      if (pts === 1) {
        // Single point — use flyTo instead of fitBounds
        const pt = sites.length > 0 ? [sites[0].longitude, sites[0].latitude] : [39.0, 26.5]
        map.current.flyTo({ center: pt as [number, number], zoom: 6, duration: 1200 })
      } else {
        map.current.fitBounds(b, { padding: 80, maxZoom: 7 })
      }
      fitted.current = true
    }
  }, [ld, sites, drones])

  // ── HAFAR AL BATIN MARKER — subtle visual reference ──
  const habRef = useRef<maplibregl.Marker | null>(null)
  useEffect(() => {
    if (!map.current || !ld) return
    if (habRef.current) { habRef.current.remove(); habRef.current = null }
    const el = document.createElement('div')
    el.style.cssText = 'width:16px;height:16px;display:flex;align-items:center;justify-content:center;pointer-events:none;'
    el.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="#EF4444" stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/><circle cx="8" cy="8" r="3" fill="#EF4444" opacity="0.15"/></svg>`
    habRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([45.9708, 28.4328])
      .addTo(map.current!)
    return () => { if (habRef.current) { habRef.current.remove(); habRef.current = null } }
  }, [ld])

  // ── SITE MARKERS ──
  useEffect(() => {
    if (!map.current || !ld) return
    console.log(`[MAP SITE] rendering ${sites.length} sites`, sites.map(s => `${s.code}:${s.color}`))
    const cur = new Set(sites.map(s => s.id))
    for (const [id, mk] of sM.current) { if (!cur.has(id)) { mk.remove(); sM.current.delete(id) } }
    const prevSelected = prevSelRef.current
    prevSelRef.current = selectedSiteId ?? null
    const seen = new Set<string>()
    for (const site of sites) {
      if (!site.id || seen.has(site.id)) continue
      seen.add(site.id)
      const { latitude: lat, longitude: lng } = site
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
      const ex = sM.current.get(site.id)
      if (ex) {
        // ALWAYS update the marker DOM — site color/name/label may have changed
        updateSiteMarkerDOM(ex, site, site.id === selectedSiteId)
        continue
      }
      const el = buildSiteMarkerEl(site, site.id === selectedSiteId)
      el.addEventListener('click', () => onSiteClick?.(site.id)); el.title = `${site.code} — ${site.name}`
      sM.current.set(site.id, new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map.current!))
    }

  }, [sites, ld, onSiteClick, selectedSiteId])

  // ── TACTICAL RING — geo-anchored via MapLibre Marker ──
  useEffect(() => {
    if (!map.current || !ld) return
    // Remove old ring marker
    if (ringRef.current) { ringRef.current.remove(); ringRef.current = null }
    const site = selectedSiteId ? sites.find(s => s.id === selectedSiteId) ?? null : null
    if (!site) return
    // Build ring element as a 200×200 container with anchor:center.
    // The SVG fills the container exactly, so the geographic coordinate is at
    // the SVG's center (100,100) which is the container's center — matching anchor:center.
    const ringEl = document.createElement('div')
    ringEl.style.cssText = 'width:200px;height:200px;pointer-events:none;opacity:0.85;'
    const currentBearing = map.current?.getBearing() ?? 0
    ringEl.innerHTML = `<svg width="200" height="200" viewBox="0 0 200 200" style="display:block;filter:drop-shadow(0 0 12px rgba(0,0,0,0.6));transform:rotate(${currentBearing}deg);transition:transform 0.1s ease-out;">${ringSVGContent()}</svg>`
    ringRef.current = new maplibregl.Marker({ element: ringEl, anchor: 'center' })
      .setLngLat([site.longitude, site.latitude])
      .addTo(map.current!)
    // Update ring rotation as map bearing changes
    const updateRotation = () => {
      const svg = ringEl.querySelector('svg')
      if (svg && map.current) svg.style.transform = `rotate(${map.current.getBearing()}deg)`
    }
    map.current.on('rotate', updateRotation)
    map.current.on('zoom', updateRotation)
    return () => {
      if (ringRef.current) { ringRef.current.remove(); ringRef.current = null }
      if (map.current) { map.current.off('rotate', updateRotation); map.current.off('zoom', updateRotation) }
    }
  }, [selectedSiteId, ld, sites])

  // ── DRONE MARKERS + LINES ──
  useEffect(() => {
    if (!map.current || !ld) return
    for (const s of lineSrc.current) {
      try { if (map.current!.getLayer(`${s}-line`)) map.current!.removeLayer(`${s}-line`) } catch {}
      try { if (map.current!.getSource(s)) map.current!.removeSource(s) } catch {}
    }
    lineSrc.current.clear()
    const cur = new Set(drones.map(d => d.id))
    for (const [id, mk] of dM.current) { if (!cur.has(id)) { mk.remove(); dM.current.delete(id) } }
    const seen = new Set<string>()
    for (const drone of drones) {
      if (!drone.id || seen.has(drone.id)) continue; seen.add(drone.id)
      const { latitude: lat, longitude: lng } = drone
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0 || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
      const hl = !!selectedSiteId && drone.sourceSiteId === selectedSiteId
      const ex = dM.current.get(drone.id)
      if (ex) {
        // CRITICAL: Only update inner visual content.
        // NEVER overwrite style.cssText — that destroys MapLibre's internal translate() transform
        // which positions the marker at its geographic coordinate.
        ex.setLngLat([lng, lat])
        const svgOnly = buildDroneSVG(drone.drone_id, drone.siteColor, drone.heading, drone.isStale, drone.id === selectedDroneId, hl)
        const existingSVG = ex.getElement().querySelector('svg')
        if (existingSVG) existingSVG.outerHTML = svgOnly
        else { ex.getElement().querySelector('[data-svg-wrap]')?.remove(); const wrap = document.createElement('div'); wrap.style.cssText = 'position:absolute;top:6px;left:6px;width:36px;height:36px;pointer-events:none;'; wrap.dataset.svgWrap = ''; wrap.innerHTML = svgOnly; ex.getElement().appendChild(wrap) }
        // Update label text
        const labelEl = ex.getElement().querySelector('[data-label]')
        if (labelEl) { (labelEl as HTMLElement).textContent = drone.drone_id; (labelEl as HTMLElement).style.color = drone.isStale ? '#ffb4ab' : drone.siteColor }
        // Update debug dot color
        const debugDot = ex.getElement().querySelector('[data-debug]')
        if (debugDot) (debugDot as HTMLElement).style.background = drone.isStale ? '#ffb4ab' : drone.siteColor
      }
      else {
        const el = buildDroneEl(drone.drone_id, drone.siteColor, drone.heading, drone.isStale, drone.id === selectedDroneId, hl); el.addEventListener('click', () => onDroneClick(drone.id)); dM.current.set(drone.id, new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map.current!))
      }
      if (hl) {
        const site = sites.find(s => s.id === selectedSiteId)
        if (site) {
          const src = `cl-${drone.id}`; lineSrc.current.add(src)
          const gj: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[site.longitude, site.latitude], [lng, lat]] } }
          try {
            if (!map.current!.getSource(src)) { map.current!.addSource(src, { type: 'geojson', data: gj }); map.current!.addLayer({ id: `${src}-line`, type: 'line', source: src, paint: { 'line-color': site.color, 'line-width': 1.5, 'line-opacity': 0.4, 'line-dasharray': [4, 4] } }) }
            else { (map.current!.getSource(src) as maplibregl.GeoJSONSource).setData(gj) }
          } catch {}
        }
      }
    }
    // ── FLIGHT TRAILS — render path history from simulation runner ──
    for (const tSrc of trailSrc.current) {
      if (!cur.has(tSrc.replace('trail-', ''))) {
        try { if (map.current!.getLayer(`${tSrc}-layer`)) map.current!.removeLayer(`${tSrc}-layer`) } catch {}
        try { if (map.current!.getSource(tSrc)) map.current!.removeSource(tSrc) } catch {}
      }
    }
    trailSrc.current.clear()
    for (const drone of drones) {
      if (!drone.id) continue
      const trail = simulationRunner.getTrail(drone.id)
      if (trail.length < 2) continue
      const srcId = `trail-${drone.id}`
      trailSrc.current.add(srcId)
      const gj: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: trail },
      }
      try {
        if (!map.current!.getSource(srcId)) {
          map.current!.addSource(srcId, { type: 'geojson', data: gj })
          map.current!.addLayer({
            id: `${srcId}-layer`,
            type: 'line',
            source: srcId,
            paint: {
              'line-color': drone.siteColor,
              'line-width': 1.5,
              'line-opacity': 0.25,
            },
          })
        } else {
          (map.current!.getSource(srcId) as maplibregl.GeoJSONSource).setData(gj)
        }
      } catch {}
    }
  }, [drones, ld, selectedDroneId, onDroneClick, selectedSiteId, sites])

  // ── AIRCRAFT MARKERS — live ADS-B data ──
  useEffect(() => {
    if (!map.current || !ld) return
    const acList = aircraft || []
    console.log(`[MAP AIRCRAFT] rendering ${acList.length} aircraft, showAircraft=${showAircraft}`)

    // ── HAB Trace: check which HAB-near aircraft reached MapView ──
    const habDistKm = (lat: number, lon: number) => {
      const R = 6371
      const toRad = (d: number) => d * Math.PI / 180
      const dLat = toRad(lat - 28.4328)
      const dLon = toRad(lon - 45.9708)
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(28.4328)) * Math.cos(toRad(lat)) * Math.sin(dLon/2)**2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    }
    for (const ac of acList) {
      const d = habDistKm(ac.latitude, ac.longitude)
      if (d <= 185.2) { // 100nm in km
        console.log(
          `[HAB TRACE MAPVIEW] ICAO=${ac.id} ` +
          `Pos=(${ac.latitude.toFixed(4)},${ac.longitude.toFixed(4)}) ` +
          `DistFromHAB=${d.toFixed(1)}km ` +
          `Callsign=${ac.callsign ?? '-'} Speed=${ac.speed ?? '?'}kt ` +
          `STATUS=RECEIVED_BY_MAPVIEW`
        )
      }
    }
    const cur = new Set(acList.map(a => a.id))
    for (const [id, mk] of aM.current) { if (!cur.has(id)) { mk.remove(); aM.current.delete(id) } }
    if (!showAircraft) {
      for (const [, mk] of aM.current) mk.remove()
      aM.current.clear()
      return
    }
    let created = 0, updated = 0, skipped = 0
    for (const ac of acList) {
      if (!ac.id) { skipped++; continue }
      const { latitude: lat, longitude: lng } = ac
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) { skipped++; continue }
      const ex = aM.current.get(ac.id)
      if (ex) {
        ex.setLngLat([lng, lat])
        const svg = ex.getElement().querySelector('svg')
        if (svg) svg.style.transform = `rotate(${ac.heading ?? 0}deg)`
        updated++
      } else {
        const el = buildAircraftEl(ac)
        el.addEventListener('click', () => onAircraftClick?.(ac))
        aM.current.set(ac.id, new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map.current!))
        created++
      }
    }
    console.log(`[MAP AIRCRAFT] created=${created} updated=${updated} skipped=${skipped} total_markers=${aM.current.size}`)
    // ── HAB Trace: count HAB-near aircraft with markers ──
    let habWithMarker = 0
    for (const [id, _mk] of aM.current) {
      const ac = acList.find(a => a.id === id)
      if (ac) {
        const d = habDistKm(ac.latitude, ac.longitude)
        if (d <= 185.2) habWithMarker++
      }
    }
    if (habWithMarker > 0) {
      console.log(`[HAB TRACE MAPVIEW] HAB-near aircraft WITH markers: ${habWithMarker}`)
    } else {
      console.log(`[HAB TRACE MAPVIEW] NO HAB-near aircraft have markers`)
    }
  }, [aircraft, ld, showAircraft, onAircraftClick])

  // ── COMPUTE: Bearing & distance from SELECTED SITE → mouse ──
  const mouseInfo = (() => {
    if (!refSite || !mousePos) return null
    const brg = calculateBearing(refSite.latitude, refSite.longitude, mousePos.lat, mousePos.lng)
    const distM = calculateDistance(refSite.latitude, refSite.longitude, mousePos.lat, mousePos.lng)
    return { bearing: brg, distKm: distM / 1000, label: bLabel(brg) }
  })()

  // ── MGRS ──
  const mgrsStr = mousePos ? (() => { try { return mgrs.forward([mousePos.lng, mousePos.lat]) as string } catch { return '' } })() : ''

  return (
    <div className="absolute inset-0" style={{ backgroundColor: 'var(--map-bg, #0A0C10)' }}>
      <div ref={mcRef} className="absolute inset-0" style={{ cursor: 'default' }} />

      {/* Top-right cluster — north arrow (rotates with map bearing) + fullscreen toggle */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div
            className="w-8 h-8 rounded border border-outline-variant bg-surface-container/80 flex items-center justify-center transition-transform duration-150"
            style={{ transform: `rotate(${-mapBearing}deg)` }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="8,2 4,14 8,11 12,14" fill="#EF4444" stroke="#EF4444" strokeWidth="0.5"/>
            </svg>
          </div>
          <span className="text-label-caps text-on-surface-variant text-[11px] font-bold">N</span>
        </div>
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="pointer-events-auto w-10 h-10 rounded border border-outline-variant bg-surface-container/90 hover:bg-surface-container-high flex items-center justify-center shadow-lg"
            title={isFullscreen ? 'Exit fullscreen map' : 'Enter fullscreen map'}
            aria-label={isFullscreen ? 'Exit fullscreen map' : 'Enter fullscreen map'}
          >
            <span className="material-symbols-outlined text-on-surface text-[20px]">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        )}
      </div>

      {/* Mouse coords bar — SITE-REFERENCED bearing and distance
          Mobile: wraps onto multiple lines so nothing is clipped; raised
          above the layer legend. Desktop: single line, unchanged. */}
      <div className={`absolute bottom-2 max-md:bottom-[80px] left-1/2 -translate-x-1/2 z-30 transition-opacity duration-200 ${mousePos ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {mousePos && (
        <div className="bg-surface-container/95 border border-outline-variant px-3 py-1.5 shadow-lg flex flex-wrap items-center justify-center gap-x-3 gap-y-1 w-max max-w-[calc(100vw-16px)]">
          <span className="text-data-mono text-[10px] text-on-surface font-medium whitespace-nowrap">LAT <span className="text-primary">{mousePos.lat.toFixed(6)}°</span><span className="text-outline ml-0.5">{mousePos.lat >= 0 ? 'N' : 'S'}</span></span>
          <span className="text-outline/30">|</span>
          <span className="text-data-mono text-[10px] text-on-surface font-medium whitespace-nowrap">LNG <span className="text-primary">{Math.abs(mousePos.lng).toFixed(6)}°</span><span className="text-outline ml-0.5">{mousePos.lng >= 0 ? 'E' : 'W'}</span></span>
          <span className="text-outline/30">|</span>
          <span className="text-data-mono text-[10px] text-[#F2994A] font-medium whitespace-nowrap">MGRS <span className="text-[#F2994A]">{mgrsStr}</span></span>
          {refSite && mouseInfo ? (
            <>
              <span className="text-outline/30">|</span>
              <span className="text-data-mono text-[10px] text-[#56CCF2] font-medium whitespace-nowrap">FROM <span className="text-[#56CCF2]">{refSite.code}</span></span>
              <span className="text-data-mono text-[10px] text-[#56CCF2] font-medium whitespace-nowrap">HDG <span className="text-[#56CCF2]">{mouseInfo.bearing.toFixed(0)}° {mouseInfo.label}</span></span>
              <span className="text-data-mono text-[10px] text-[#56CCF2] font-medium whitespace-nowrap">DIST <span className="text-[#56CCF2]">{mouseInfo.distKm.toFixed(1)} km</span></span>
            </>
          ) : (
            <><span className="text-outline/30">|</span><span className="text-data-mono text-[10px] text-outline whitespace-nowrap">SELECT A SITE FOR REFERENCE</span></>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
