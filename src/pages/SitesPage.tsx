import { useState, useEffect } from 'react'
import { PageLayout } from '@/layouts/PageLayout'
import { SiteCard } from '@/features/sites/components/SiteCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useSitesData, type CreateSiteInput } from '@/hooks/useSitesData'
import { isDemoMode, getDemoSites } from '@/utils/demoMode'
import { mockDrones } from '@/utils/mockData'
import type { Site, Drone } from '@/types'
import { MasterAdminGuard } from '@/features/auth/components/ProtectedRoute'
import {
  parseMgrs,
  parseDecimalDegrees,
  parseDdm,
  parseDms,
  ddToDdm,
  ddToDms,
  detectFormat,
  type CoordFormat,
} from '@/lib/coordinates'

const PRESET_COLORS = ['#2F80ED', '#27AE60', '#F2994A', '#9B51E0', '#56CCF2', '#EB5757', '#E91E63', '#00BCD4']

type LocationFormat = 'mgrs' | 'dd' | 'ddm' | 'dms'

const FORMAT_LABELS: Record<LocationFormat, string> = {
  mgrs: 'MGRS',
  dd: 'Decimal Degrees (DD)',
  ddm: 'Degrees Decimal Minutes (DD°MM.MMM\')',
  dms: 'Degrees Minutes Seconds (DD°MM\'SS.S")',
}

const FORMAT_SHORT: Record<LocationFormat, string> = {
  mgrs: 'MGRS',
  dd: 'DD',
  ddm: 'DDM',
  dms: 'DMS',
}

export function SitesPage() {
  const { isAdmin, isMasterAdmin } = useAuth()
  const {
    sites,
    loading,
    error,
    refresh,
    createNewSite,
    editSite,
    removeSite,
    droneCounts,
  } = useSitesData()

  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<Site | null>(null)

  // Add/Edit form state
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formColor, setFormColor] = useState('#2F80ED')
  const [formRadius, setFormRadius] = useState('5.0')
  const [formDescription, setFormDescription] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Coordinate format state
  const [coordFormat, setCoordFormat] = useState<LocationFormat>('dd')
  const [formCoordInput, setFormCoordInput] = useState('')
  const [formCoordLat, setFormCoordLat] = useState('')
  const [formCoordLng, setFormCoordLng] = useState('')
  const [formCoordMgrs, setFormCoordMgrs] = useState('')
  // DDM fields — numeric only
  const [formDdmLatDeg, setFormDdmLatDeg] = useState('')
  const [formDdmLatMin, setFormDdmLatMin] = useState('')
  const [formDdmLatHemi, setFormDdmLatHemi] = useState('N')
  const [formDdmLngDeg, setFormDdmLngDeg] = useState('')
  const [formDdmLngMin, setFormDdmLngMin] = useState('')
  const [formDdmLngHemi, setFormDdmLngHemi] = useState('E')
  // DMS fields — numeric only
  const [formDmsLatDeg, setFormDmsLatDeg] = useState('')
  const [formDmsLatMin, setFormDmsLatMin] = useState('')
  const [formDmsLatSec, setFormDmsLatSec] = useState('')
  const [formDmsLatHemi, setFormDmsLatHemi] = useState('N')
  const [formDmsLngDeg, setFormDmsLngDeg] = useState('')
  const [formDmsLngMin, setFormDmsLngMin] = useState('')
  const [formDmsLngSec, setFormDmsLngSec] = useState('')
  const [formDmsLngHemi, setFormDmsLngHemi] = useState('E')

  // Load assigned drones when viewing site details
  const [siteDrones, setSiteDrones] = useState<Drone[]>([])
  useEffect(() => {
    if (selectedSite) {
      if (isDemoMode()) {
        setSiteDrones(mockDrones.filter((d) => d.source_site_id === selectedSite.id))
      } else {
        setSiteDrones([]) // Will be fetched from Supabase in Phase 6
      }
    }
  }, [selectedSite])

  const resetAddForm = () => {
    setFormName('')
    setFormCode('')
    setFormColor('#2F80ED')
    setFormRadius('5.0')
    setFormDescription('')
    setFormError(null)
    setCoordFormat('dd')
    setFormCoordInput('')
    setFormCoordLat('')
    setFormCoordLng('')
    setFormCoordMgrs('')
    setFormDdmLatDeg(''); setFormDdmLatMin(''); setFormDdmLatHemi('N')
    setFormDdmLngDeg(''); setFormDdmLngMin(''); setFormDdmLngHemi('E')
    setFormDmsLatDeg(''); setFormDmsLatMin(''); setFormDmsLatSec(''); setFormDmsLatHemi('N')
    setFormDmsLngDeg(''); setFormDmsLngMin(''); setFormDmsLngSec(''); setFormDmsLngHemi('E')
  }

  /** Populate coordinate fields from known lat/lng when switching formats */
  const populateCoordsFromLatLng = (lat: number, lng: number) => {
    setFormCoordLat(String(lat))
    setFormCoordLng(String(lng))
    setFormCoordInput(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
    // Populate DDM fields (numeric degrees/minutes)
    const latAbs = Math.abs(lat); const lngAbs = Math.abs(lng)
    const latDeg = Math.floor(latAbs); const latMin = ((latAbs - latDeg) * 60).toFixed(3)
    const lngDeg = Math.floor(lngAbs); const lngMin = ((lngAbs - lngDeg) * 60).toFixed(3)
    setFormDdmLatDeg(String(latDeg)); setFormDdmLatMin(latMin); setFormDdmLatHemi(lat >= 0 ? 'N' : 'S')
    setFormDdmLngDeg(String(lngDeg)); setFormDdmLngMin(lngMin); setFormDdmLngHemi(lng >= 0 ? 'E' : 'W')
    // Populate DMS fields (numeric degrees/minutes/seconds)
    const dms = ddToDms(lat, lng)
    const dmsLatParts = dms.latStr.match(/(\d+)°(\d+)'([\d.]+)"/)
    const dmsLngParts = dms.lngStr.match(/(\d+)°(\d+)'([\d.]+)"/)
    if (dmsLatParts) {
      setFormDmsLatDeg(dmsLatParts[1]); setFormDmsLatMin(dmsLatParts[2]); setFormDmsLatSec(dmsLatParts[3])
    }
    if (dmsLngParts) {
      setFormDmsLngDeg(dmsLngParts[1]); setFormDmsLngMin(dmsLngParts[2]); setFormDmsLngSec(dmsLngParts[3])
    }
  }

  const resetEditForm = (site: Site | null) => {
    if (site) {
      setFormName(site.name)
      setFormCode(site.code)
      setFormColor(site.color)
      setFormRadius(String(site.radius_km))
      setFormDescription(site.description || '')
      setFormError(null)
      // Populate all coordinate fields from the site's stored DD
      setCoordFormat('dd')
      populateCoordsFromLatLng(site.latitude, site.longitude)
    }
  }

  /** Parse coordinates from the currently selected format. Throws on invalid. */
  const parseCurrentCoords = (): { lat: number; lng: number } => {
    switch (coordFormat) {
      case 'mgrs':
        return parseMgrs(formCoordMgrs)
      case 'dd': {
        if (!formCoordLat || !formCoordLng) throw new Error('Latitude and Longitude are required.')
        return parseDecimalDegrees(`${formCoordLat}, ${formCoordLng}`)
      }
      case 'ddm': {
        if (!formDdmLatDeg || !formDdmLatMin) throw new Error('Latitude degrees and minutes required.')
        if (!formDdmLngDeg || !formDdmLngMin) throw new Error('Longitude degrees and minutes required.')
        return parseDdm(`${formDdmLatDeg}°${formDdmLatMin}'${formDdmLatHemi} ${formDdmLngDeg}°${formDdmLngMin}'${formDdmLngHemi}`)
      }
      case 'dms': {
        if (!formDmsLatDeg || !formDmsLatMin || !formDmsLatSec) throw new Error('Latitude degrees, minutes, and seconds required.')
        if (!formDmsLngDeg || !formDmsLngMin || !formDmsLngSec) throw new Error('Longitude degrees, minutes, and seconds required.')
        return parseDms(`${formDmsLatDeg}°${formDmsLatMin}'${formDmsLatSec}"${formDmsLatHemi} ${formDmsLngDeg}°${formDmsLngMin}'${formDmsLngSec}"${formDmsLngHemi}`)
      }
    }
  }

  const handleCreate = async () => {
    setFormError(null)

    if (!formName || !formCode) {
      setFormError('Name and Code are required.')
      return
    }

    let lat: number, lng: number
    try {
      const coords = parseCurrentCoords()
      lat = coords.lat
      lng = coords.lng
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid coordinates.')
      return
    }

    const radius = parseFloat(formRadius) || 5.0

    setFormSubmitting(true)
    const input: CreateSiteInput = {
      name: formName,
      code: formCode.toUpperCase().replace(/\s+/g, '-'),
      color: formColor,
      latitude: lat,
      longitude: lng,
      radius_km: radius,
      description: formDescription || undefined,
    }
    const result = await createNewSite(input)
    setFormSubmitting(false)
    if (result) {
      setShowAdd(false)
      resetAddForm()
    }
  }

  const handleEdit = async () => {
    if (!editForm) return
    setFormError(null)
    if (!formName || !formCode) {
      setFormError('Name and Code are required.')
      return
    }

    let lat: number, lng: number
    try {
      const coords = parseCurrentCoords()
      lat = coords.lat
      lng = coords.lng
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid coordinates.')
      return
    }

    setFormSubmitting(true)
    const result = await editSite(editForm.id, {
      name: formName,
      code: formCode.toUpperCase().replace(/\s+/g, '-'),
      color: formColor,
      latitude: lat,
      longitude: lng,
      radius_km: parseFloat(formRadius) || 5.0,
      description: formDescription || null,
    })
    setFormSubmitting(false)
    if (result) {
      setShowEdit(false)
      setEditForm(null)
      setSelectedSite(result)
    }
  }

  return (
    <PageLayout title="Operating Sites">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-body-sm text-on-surface-variant">
              Manage deployment sites and their operational status.
            </p>
            {loading && (
              <span className="text-data-mono text-[10px] text-primary mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Loading sites...
              </span>
            )}
          </div>
          <MasterAdminGuard>
            <Button variant="primary" icon="add" onClick={() => { resetAddForm(); setShowAdd(true) }}>
              Add Site
            </Button>
          </MasterAdminGuard>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-error-container/10 border border-error/30 p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-sm">error</span>
              <p className="text-body-sm text-on-error-container">{error}</p>
            </div>
            <button onClick={() => refresh()} className="text-primary text-label-caps hover:underline">Retry</button>
          </div>
        )}

        {/* Loading State */}
        {loading && sites.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container border border-outline-variant p-5 animate-pulse">
                <div className="h-4 bg-surface-variant w-24 mb-2" />
                <div className="h-6 bg-surface-variant w-36 mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 bg-surface-variant" />
                  <div className="h-16 bg-surface-variant" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Site Detail Modal */}
        {selectedSite && (
          <Modal
            isOpen={!!selectedSite}
            onClose={() => { setSelectedSite(null); setEditForm(null) }}
            title={`${selectedSite.code} — ${selectedSite.name}`}
            size="md"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedSite.color }} />
                  <div>
                    <span className="text-label-caps text-outline">Status</span>
                    <p className={`text-data-mono ${selectedSite.is_active ? 'text-[#27AE60]' : 'text-outline'}`}>
                      {selectedSite.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
                <MasterAdminGuard>
                  <button
                    className={`text-label-caps px-2 py-1 border transition-colors ${
                      selectedSite.is_active
                        ? 'text-[#F2994A] border-[#F2994A]/30 hover:bg-[#F2994A]/10'
                        : 'text-[#27AE60] border-[#27AE60]/30 hover:bg-[#27AE60]/10'
                    }`}
                    onClick={async () => {
                      await editSite(selectedSite.id, { is_active: !selectedSite.is_active })
                      setSelectedSite(prev => prev ? { ...prev, is_active: !prev.is_active } : null)
                    }}
                  >
                    {selectedSite.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </MasterAdminGuard>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface p-3 border border-outline-variant">
                  <p className="text-label-caps text-outline">LATITUDE</p>
                  <p className="text-data-mono text-on-surface">{selectedSite.latitude.toFixed(6)}° N</p>
                </div>
                <div className="bg-surface p-3 border border-outline-variant">
                  <p className="text-label-caps text-outline">LONGITUDE</p>
                  <p className="text-data-mono text-on-surface">{Math.abs(selectedSite.longitude).toFixed(6)}° W</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface p-3 border border-outline-variant">
                  <p className="text-label-caps text-outline">RADIUS</p>
                  <p className="text-data-mono text-on-surface">{selectedSite.radius_km} km</p>
                </div>
                <div className="bg-surface p-3 border border-outline-variant">
                  <p className="text-label-caps text-outline">COLOR</p>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedSite.color }} />
                    <span className="text-data-mono text-on-surface-variant">{selectedSite.color}</span>
                  </div>
                </div>
              </div>

              {selectedSite.description && (
                <div className="bg-surface p-3 border border-outline-variant">
                  <p className="text-label-caps text-outline mb-1">DESCRIPTION</p>
                  <p className="text-body-sm text-on-surface-variant">{selectedSite.description}</p>
                </div>
              )}

              <div className="bg-surface p-3 border border-outline-variant">
                <p className="text-label-caps text-outline mb-2">ASSIGNED DRONES ({siteDrones.length})</p>
                {siteDrones.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">No drones assigned to this site.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {siteDrones.map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-1 px-2 bg-surface-container-low">
                        <span className="text-data-mono text-on-surface">{d.drone_id}</span>
                        <span className="text-data-mono text-[10px] text-on-surface-variant capitalize">{d.simulation_status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Color usage indicator */}
              <Card className="p-3">
                <p className="text-label-caps text-outline mb-2">SITE COLOR PREVIEW</p>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full border-2 border-outline-variant" style={{ backgroundColor: selectedSite.color }} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedSite.color }} />
                      <span className="text-label-caps text-on-surface-variant">Drone badges</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedSite.color }} />
                      <span className="text-label-caps text-on-surface-variant">Map markers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedSite.color }} />
                      <span className="text-label-caps text-on-surface-variant">Timeline events</span>
                    </div>
                  </div>
                </div>
              </Card>

                <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setSelectedSite(null)}>Close</Button>
                <MasterAdminGuard>
                  <Button
                    variant="danger"
                    icon="delete"
                    onClick={async () => {
                      if (selectedSite && window.confirm(`Are you sure you want to delete ${selectedSite.code} — ${selectedSite.name}? This action cannot be undone.`)) {
                        await removeSite(selectedSite.id)
                        setSelectedSite(null)
                      }
                    }}
                  >
                    Delete Site
                  </Button>
                </MasterAdminGuard>
                <MasterAdminGuard fallback={
                  <span className="text-body-sm text-outline px-2 py-1">Only Master Admin can edit site locations.</span>
                }>
                  <Button
                    variant="primary"
                    icon="edit"
                    onClick={() => {
                      setEditForm(selectedSite)
                      resetEditForm(selectedSite)
                      setShowEdit(true)
                    }}
                  >
                    Edit Site
                  </Button>
                </MasterAdminGuard>
              </div>
            </div>
          </Modal>
        )}

        {/* Add Site Modal */}
        <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Site" size="md">
          <div className="space-y-4">
            {formError && (
              <div className="bg-error-container/10 border border-error/30 p-3">
                <p className="text-body-sm text-on-error-container">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input label="Site Name" placeholder="e.g. West Side" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              <Input label="Site Code" placeholder="e.g. SITE-06" value={formCode} onChange={(e) => setFormCode(e.target.value)} required hint="Will be uppercased" />
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <label className="text-label-caps text-on-surface-variant">Site Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formColor === c ? 'border-on-surface scale-110' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormColor(c)}
                  />
                ))}
              </div>
              <input
                type="text"
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-1.5 px-3 mt-1 text-sm outline-none focus:border-primary"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                placeholder="#HEX color"
              />
            </div>

            {/* Coordinate Format Selector */}
            <div className="space-y-2">
              <label className="text-label-caps text-on-surface-variant">Location Format</label>
              <div className="flex flex-wrap gap-1">
                {(['dd', 'ddm', 'dms', 'mgrs'] as LocationFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={`px-3 py-1.5 text-[10px] font-bold border transition-all min-h-[36px] ${
                      coordFormat === fmt
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    onClick={() => {
                      // When switching formats, convert existing DD values to the new format
                      if (coordFormat !== fmt && formCoordLat && formCoordLng) {
                        const lat = parseFloat(formCoordLat)
                        const lng = parseFloat(formCoordLng)
                        if (!isNaN(lat) && !isNaN(lng)) {
                          if (fmt === 'dd') {
                            setFormCoordLat(String(lat))
                            setFormCoordLng(String(lng))
                            setFormCoordInput(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
                          } else if (fmt === 'ddm') {
                            const latAbs = Math.abs(lat); const lngAbs = Math.abs(lng)
                            setFormDdmLatDeg(String(Math.floor(latAbs)))
                            setFormDdmLatMin(((latAbs - Math.floor(latAbs)) * 60).toFixed(3))
                            setFormDdmLatHemi(lat >= 0 ? 'N' : 'S')
                            setFormDdmLngDeg(String(Math.floor(lngAbs)))
                            setFormDdmLngMin(((lngAbs - Math.floor(lngAbs)) * 60).toFixed(3))
                            setFormDdmLngHemi(lng >= 0 ? 'E' : 'W')
                          } else if (fmt === 'dms') {
                            const dms = ddToDms(lat, lng)
                            const latP = dms.latStr.match(/(\d+)°(\d+)'([\d.]+)"/)
                            const lngP = dms.lngStr.match(/(\d+)°(\d+)'([\d.]+)"/)
                            if (latP) { setFormDmsLatDeg(latP[1]); setFormDmsLatMin(latP[2]); setFormDmsLatSec(latP[3]) }
                            if (lngP) { setFormDmsLngDeg(lngP[1]); setFormDmsLngMin(lngP[2]); setFormDmsLngSec(lngP[3]) }
                          }
                          // mgrs has no auto-convert from DD — user must type
                        }
                      }
                      setCoordFormat(fmt)
                    }}
                  >
                    {FORMAT_SHORT[fmt]}
                  </button>
                ))}
              </div>
            </div>

            {/* Format-specific input fields */}
            {coordFormat === 'dd' && (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Latitude (DD)" type="number" step="any" placeholder="e.g. 28.4328" value={formCoordLat} onChange={(e) => {
                  setFormCoordLat(e.target.value)
                  setFormCoordInput(`${e.target.value}, ${formCoordLng}`)
                }} required />
                <Input label="Longitude (DD)" type="number" step="any" placeholder="e.g. 45.9708" value={formCoordLng} onChange={(e) => {
                  setFormCoordLng(e.target.value)
                  setFormCoordInput(`${formCoordLat}, ${e.target.value}`)
                }} required />
              </div>
            )}

            {coordFormat === 'ddm' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat Degrees</label>
                    <input type="number" step="any" placeholder="28" value={formDdmLatDeg} onChange={(e) => setFormDdmLatDeg(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat Minutes</label>
                    <input type="number" step="any" placeholder="25.968" value={formDdmLatMin} onChange={(e) => setFormDdmLatMin(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Hemisphere</label>
                    <select value={formDdmLatHemi} onChange={(e) => setFormDdmLatHemi(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary">
                      <option value="N">N</option>
                      <option value="S">S</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng Degrees</label>
                    <input type="number" step="any" placeholder="45" value={formDdmLngDeg} onChange={(e) => setFormDdmLngDeg(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng Minutes</label>
                    <input type="number" step="any" placeholder="58.248" value={formDdmLngMin} onChange={(e) => setFormDdmLngMin(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Hemisphere</label>
                    <select value={formDdmLngHemi} onChange={(e) => setFormDdmLngHemi(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary">
                      <option value="E">E</option>
                      <option value="W">W</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {coordFormat === 'dms' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat °</label>
                    <input type="number" step="any" placeholder="28" value={formDmsLatDeg} onChange={(e) => setFormDmsLatDeg(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat '</label>
                    <input type="number" step="any" placeholder="25" value={formDmsLatMin} onChange={(e) => setFormDmsLatMin(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat ."</label>
                    <input type="number" step="any" placeholder="58.1" value={formDmsLatSec} onChange={(e) => setFormDmsLatSec(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Hem</label>
                    <select value={formDmsLatHemi} onChange={(e) => setFormDmsLatHemi(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary">
                      <option value="N">N</option>
                      <option value="S">S</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng °</label>
                    <input type="number" step="any" placeholder="45" value={formDmsLngDeg} onChange={(e) => setFormDmsLngDeg(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng '</label>
                    <input type="number" step="any" placeholder="58" value={formDmsLngMin} onChange={(e) => setFormDmsLngMin(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng ."</label>
                    <input type="number" step="any" placeholder="14.9" value={formDmsLngSec} onChange={(e) => setFormDmsLngSec(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Hem</label>
                    <select value={formDmsLngHemi} onChange={(e) => setFormDmsLngHemi(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary">
                      <option value="E">E</option>
                      <option value="W">W</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {coordFormat === 'mgrs' && (
              <Input label="MGRS Coordinate" placeholder="e.g. 38R PU 12345 67890" value={formCoordMgrs} onChange={(e) => setFormCoordMgrs(e.target.value)} required hint="Grid zone + easting + northing" />
            )}

            {/* Preview — show converted DD value for non-DD formats */}
            {coordFormat !== 'dd' && (() => {
              try {
                const coords = parseCurrentCoords()
                return (
                  <div className="bg-surface-container-lowest border border-outline-variant p-2 text-data-mono text-[10px] text-on-surface-variant">
                    Decimal Degrees: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </div>
                )
              } catch {
                return null
              }
            })()}

            <Input label="Radius (km)" type="number" min={0.1} step={0.1} placeholder="5.0" value={formRadius} onChange={(e) => setFormRadius(e.target.value)} />

            <div className="space-y-1.5">
              <label className="text-label-caps text-on-surface-variant">Description</label>
              <textarea
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-body-base p-3 outline-none focus:border-primary transition-all resize-none"
                rows={3}
                placeholder="Optional site description..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="primary" type="button" icon="add_location" onClick={handleCreate} disabled={formSubmitting}>
                {formSubmitting ? 'Creating...' : 'Create Site'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Site Modal */}
        <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit Site — ${editForm?.code || ''}`} size="md">
          <div className="space-y-4">
            {formError && (
              <div className="bg-error-container/10 border border-error/30 p-3">
                <p className="text-body-sm text-on-error-container">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input label="Site Name" placeholder="e.g. West Side" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              <Input label="Site Code" placeholder="e.g. SITE-06" value={formCode} onChange={(e) => setFormCode(e.target.value)} required />
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <label className="text-label-caps text-on-surface-variant">Site Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formColor === c ? 'border-on-surface scale-110' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormColor(c)}
                  />
                ))}
              </div>
              <input
                type="text"
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-1.5 px-3 mt-1 text-sm outline-none focus:border-primary"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
              />
            </div>

            {/* Coordinate Format Selector (Edit) */}
            <div className="space-y-2">
              <label className="text-label-caps text-on-surface-variant">Location Format</label>
              <div className="flex flex-wrap gap-1">
                {(['dd', 'ddm', 'dms', 'mgrs'] as LocationFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={`px-3 py-1.5 text-[10px] font-bold border transition-all min-h-[36px] ${
                      coordFormat === fmt
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    onClick={() => {
                      if (coordFormat !== fmt && formCoordLat && formCoordLng) {
                        const lat = parseFloat(formCoordLat)
                        const lng = parseFloat(formCoordLng)
                        if (!isNaN(lat) && !isNaN(lng)) {
                          if (fmt === 'dd') {
                            setFormCoordLat(String(lat))
                            setFormCoordLng(String(lng))
                            setFormCoordInput(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
                          } else if (fmt === 'ddm') {
                            const latAbs = Math.abs(lat); const lngAbs = Math.abs(lng)
                            setFormDdmLatDeg(String(Math.floor(latAbs)))
                            setFormDdmLatMin(((latAbs - Math.floor(latAbs)) * 60).toFixed(3))
                            setFormDdmLatHemi(lat >= 0 ? 'N' : 'S')
                            setFormDdmLngDeg(String(Math.floor(lngAbs)))
                            setFormDdmLngMin(((lngAbs - Math.floor(lngAbs)) * 60).toFixed(3))
                            setFormDdmLngHemi(lng >= 0 ? 'E' : 'W')
                          } else if (fmt === 'dms') {
                            const dms = ddToDms(lat, lng)
                            const latP = dms.latStr.match(/(\d+)°(\d+)'([\d.]+)"/)
                            const lngP = dms.lngStr.match(/(\d+)°(\d+)'([\d.]+)"/)
                            if (latP) { setFormDmsLatDeg(latP[1]); setFormDmsLatMin(latP[2]); setFormDmsLatSec(latP[3]) }
                            if (lngP) { setFormDmsLngDeg(lngP[1]); setFormDmsLngMin(lngP[2]); setFormDmsLngSec(lngP[3]) }
                          }
                        }
                      }
                      setCoordFormat(fmt)
                    }}
                  >
                    {FORMAT_SHORT[fmt]}
                  </button>
                ))}
              </div>
            </div>

            {coordFormat === 'dd' && (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Latitude (DD)" type="number" step="any" placeholder="e.g. 28.4328" value={formCoordLat} onChange={(e) => {
                  setFormCoordLat(e.target.value)
                  setFormCoordInput(`${e.target.value}, ${formCoordLng}`)
                }} required />
                <Input label="Longitude (DD)" type="number" step="any" placeholder="e.g. 45.9708" value={formCoordLng} onChange={(e) => {
                  setFormCoordLng(e.target.value)
                  setFormCoordInput(`${formCoordLat}, ${e.target.value}`)
                }} required />
              </div>
            )}

            {coordFormat === 'ddm' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat Degrees</label>
                    <input type="number" step="any" placeholder="28" value={formDdmLatDeg} onChange={(e) => setFormDdmLatDeg(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat Minutes</label>
                    <input type="number" step="any" placeholder="25.968" value={formDdmLatMin} onChange={(e) => setFormDdmLatMin(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Hemisphere</label>
                    <select value={formDdmLatHemi} onChange={(e) => setFormDdmLatHemi(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary">
                      <option value="N">N</option>
                      <option value="S">S</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng Degrees</label>
                    <input type="number" step="any" placeholder="45" value={formDdmLngDeg} onChange={(e) => setFormDdmLngDeg(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng Minutes</label>
                    <input type="number" step="any" placeholder="58.248" value={formDdmLngMin} onChange={(e) => setFormDdmLngMin(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Hemisphere</label>
                    <select value={formDdmLngHemi} onChange={(e) => setFormDdmLngHemi(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary">
                      <option value="E">E</option>
                      <option value="W">W</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {coordFormat === 'dms' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat °</label>
                    <input type="number" step="any" placeholder="28" value={formDmsLatDeg} onChange={(e) => setFormDmsLatDeg(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat '</label>
                    <input type="number" step="any" placeholder="25" value={formDmsLatMin} onChange={(e) => setFormDmsLatMin(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lat ."</label>
                    <input type="number" step="any" placeholder="58.1" value={formDmsLatSec} onChange={(e) => setFormDmsLatSec(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Hem</label>
                    <select value={formDmsLatHemi} onChange={(e) => setFormDmsLatHemi(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary">
                      <option value="N">N</option>
                      <option value="S">S</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng °</label>
                    <input type="number" step="any" placeholder="45" value={formDmsLngDeg} onChange={(e) => setFormDmsLngDeg(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng '</label>
                    <input type="number" step="any" placeholder="58" value={formDmsLngMin} onChange={(e) => setFormDmsLngMin(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Lng ."</label>
                    <input type="number" step="any" placeholder="14.9" value={formDmsLngSec} onChange={(e) => setFormDmsLngSec(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-label-caps text-on-surface-variant text-[10px] block mb-1">Hem</label>
                    <select value={formDmsLngHemi} onChange={(e) => setFormDmsLngHemi(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2 px-3 text-sm outline-none focus:border-primary">
                      <option value="E">E</option>
                      <option value="W">W</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {coordFormat === 'mgrs' && (
              <Input label="MGRS Coordinate" placeholder="e.g. 38R PU 12345 67890" value={formCoordMgrs} onChange={(e) => setFormCoordMgrs(e.target.value)} required hint="Grid zone + easting + northing" />
            )}

            {/* Preview — show converted DD value for non-DD formats */}
            {coordFormat !== 'dd' && (() => {
              try {
                const coords = parseCurrentCoords()
                return (
                  <div className="bg-surface-container-lowest border border-outline-variant p-2 text-data-mono text-[10px] text-on-surface-variant">
                    Decimal Degrees: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </div>
                )
              } catch {
                return null
              }
            })()}

            <Input label="Radius (km)" type="number" min={0.1} step={0.1} value={formRadius} onChange={(e) => setFormRadius(e.target.value)} />

            <div className="space-y-1.5">
              <label className="text-label-caps text-on-surface-variant">Description</label>
              <textarea
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-body-base p-3 outline-none focus:border-primary transition-all resize-none"
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button variant="primary" type="button" icon="save" onClick={handleEdit} disabled={formSubmitting}>
                {formSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Empty state */}
        {!loading && sites.length === 0 && !error && (
          <div className="bg-surface-container border border-outline-variant p-12 text-center">
            <span className="material-symbols-outlined text-outline text-5xl block mb-3">location_off</span>
            <h3 className="text-headline-md text-on-surface mb-2">No Sites Found</h3>
            <p className="text-body-sm text-on-surface-variant mb-4 max-w-md mx-auto">
              No operating sites are configured yet. Sites are needed to register and track drones.
            </p>
            {isMasterAdmin && (
              <Button variant="primary" icon="add" onClick={() => { resetAddForm(); setShowAdd(true) }}>
                Create First Site
              </Button>
            )}
          </div>
        )}

        {/* Site Grid */}
        {sites.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                droneCount={droneCounts[site.id] || 0}
                assignedDrones={isDemoMode() ? mockDrones.filter((d) => d.source_site_id === site.id) : []}
                onSelect={(s) => setSelectedSite(s)}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
