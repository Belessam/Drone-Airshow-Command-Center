import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { useDronesData } from '@/hooks/useDronesData'
import { calculateDestinationPoint, calculateDistance, calculateBearing } from '@/lib/simulation/engine'
import { simulationRunner } from '@/lib/simulation/runner'
import { validateDroneForm } from '@/utils/validation'
import { isDemoMode, DEMO_SITES, DEMO_USERS } from '@/utils/demoMode'
import { mockSites } from '@/utils/mockData'

interface AddDroneModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (droneLocation: { latitude: number; longitude: number }) => void
  /** Live site data from the Dashboard (refreshed after site edits). If omitted, falls back to AuthContext sites. */
  liveSites?: import('@/types').Site[]
}

export function AddDroneModal({ isOpen, onClose, onCreated, liveSites }: AddDroneModalProps) {
  const { user, userSite, sites: authSites, isMasterAdmin, canWrite } = useAuth()
  // Use liveSites if provided (DashboardPage's refreshed data), otherwise AuthContext sites.
  const sites = liveSites ?? authSites
  const { createDrone } = useDronesData()

  const [droneId, setDroneId] = useState('')
  const [headingFrom, setHeadingFrom] = useState('')
  const [headingTo, setHeadingTo] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [speed, setSpeed] = useState('')
  const [altitude, setAltitude] = useState('')
  const [flightRelation, setFlightRelation] = useState<'approaching' | 'away'>('away')
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Resolve user's assigned site ID — synchronous, all sources ──
  const resolvedSiteId = useMemo(() => {
    const id = (() => {
      if (userSite?.id) return userSite.id
      if (user?.site_id) return user.site_id
      if (isDemoMode() && user?.username) {
        const found = DEMO_USERS.find(u => u.username === user.username)
        if (found?.site_id) return found.site_id
      }
      return null
    })()
    return id
  }, [user, userSite])

  // Sync selectedSiteId whenever modal opens — for all users
  useEffect(() => {
    if (isOpen && resolvedSiteId) {
      setSelectedSiteId(resolvedSiteId)
    }
  }, [isOpen, resolvedSiteId])

  // Sync selectedSiteId from resolvedSiteId when modal opens (admin auto-assign)
  // SelectedSiteId for master admin is set by dropdown onChange
  // This effect is intentionally thin — it only pre-fills for non-master-admin

  // For non-master-admin: use resolvedSiteId directly. Master: use dropdown.
  const effectiveSiteId: string | null = isMasterAdmin ? selectedSiteId : resolvedSiteId

  // Resolve full site object — LIVE data is authoritative.
  // Priority: sites (Supabase live) > DEMO_SITES (demo fallback) > mockSites (last resort).
  // This ensures that when a Master Admin edits a site's lat/lng in Supabase,
  // the drone always deploys relative to the CURRENT site location — not a hardcoded one.
  const effectiveSite = effectiveSiteId
    ? (sites.find((s) => s.id === effectiveSiteId) ||
       DEMO_SITES.find((s) => s.id === effectiveSiteId) ||
       mockSites.find((s) => s.id === effectiveSiteId) ||
       null)
    : null
  const siteColor = effectiveSite?.color || '#abc7ff'


  const hdgFrom = parseFloat(headingFrom)
  const hdgTo = parseFloat(headingTo)
  const hasValidRange = !isNaN(hdgFrom) && !isNaN(hdgTo)
  // Initial deployment uses START of heading range, not midpoint
  const deploymentHeading = hasValidRange ? hdgFrom : NaN
  const distanceMeters = parseFloat(distanceKm || '0') * 1000
  const hasValidCalc = effectiveSite && !isNaN(deploymentHeading) && distanceMeters > 0

  const calculatedPosition = hasValidCalc
    ? calculateDestinationPoint(effectiveSite!.latitude, effectiveSite!.longitude, deploymentHeading, distanceMeters)
    : null

  const handleClose = () => {
    setDroneId('')
    setHeadingFrom('')
    setHeadingTo('')
    setDistanceKm('')
    setSpeed('')
    setAltitude('')
    setFlightRelation('away')
    setSelectedSiteId(resolvedSiteId || '')
    setFormErrors({})
    setSubmitError(null)
    setSuccess(false)
    setSubmitting(false)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErrors({})
    setSubmitError(null)

    if (isNaN(hdgFrom) || hdgFrom < 0 || hdgFrom >= 360) {
      setFormErrors({ headingFrom: 'Valid heading From 0-360 required.' })
      return
    }
    if (isNaN(hdgTo) || hdgTo < 0 || hdgTo >= 360) {
      setFormErrors({ headingTo: 'Valid heading To 0-360 required.' })
      return
    }
    if (distanceMeters <= 0) {
      setFormErrors({ distanceKm: 'Distance must be greater than 0.' })
      return
    }
    if (isNaN(deploymentHeading)) {
      setFormErrors({ headingFrom: 'Could not compute initial heading from range.' })
      return
    }

    if (!effectiveSite || !effectiveSiteId) {
      const msg = isMasterAdmin
        ? 'Unable to determine the selected site. Please select a site from the dropdown.'
        : 'Unable to determine your assigned site. Please contact an administrator.'
      setSubmitError(msg)
      return
    }

    const validation = validateDroneForm({
      droneId,
      latitude: String(calculatedPosition?.latitude ?? ''),
      longitude: String(calculatedPosition?.longitude ?? ''),
      heading: String(deploymentHeading),
      speed,
      altitude,
    })
    if (!validation.valid) {
      setFormErrors(validation.errors)
      // Show a general error so the user knows something is wrong
      const firstError = Object.values(validation.errors)[0]
      setSubmitError(`Validation error: ${firstError}`)
      return
    }
    if (!calculatedPosition) {
      setFormErrors({ headingFrom: 'Could not calculate position. Check heading and distance.' })
      setSubmitError('Could not calculate initial drone position. Check heading and distance values.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        drone_id: droneId.trim(),
        source_site_id: effectiveSiteId,
        latitude: calculatedPosition.latitude,
        longitude: calculatedPosition.longitude,
        altitude: parseFloat(altitude),
        heading: deploymentHeading,
        speed_mps: parseFloat(speed),
        user_id: user?.id ?? null,
        headingFrom: hdgFrom,
        headingTo: hdgTo,
        flight_relation: flightRelation,
      }
      const result = await createDrone(payload)

      if (result) {
        // Register drone with the simulation runner, passing heading range and flight relation
        simulationRunner.upsertDrone(result, hdgFrom, hdgTo, flightRelation)
        setSuccess(true)
        onCreated?.({ latitude: result.last_confirmed_latitude, longitude: result.last_confirmed_longitude })
        setTimeout(handleClose, 1200)
      } else {
        setSubmitError('Failed to create drone. Please try again.')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('[DRONE INSERT ERROR]', errorMsg)
      setSubmitError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const dirLabel = !isNaN(deploymentHeading)
    ? ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(deploymentHeading / 22.5) % 16]
    : ''

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Register New Drone" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {success && (
          <div className="bg-[#27AE60]/10 border border-[#27AE60]/30 p-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#27AE60]">check_circle</span>
            <p className="text-body-sm text-[#27AE60] font-medium">Drone {droneId} registered successfully!</p>
          </div>
        )}
        {submitError && (
          <div className="bg-error-container/10 border border-error/30 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-error text-sm mt-0.5">error</span>
            <p className="text-body-sm text-on-error-container">{submitError}</p>
          </div>
        )}

        <Card className="p-3 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: siteColor }} />
          <div className="flex-1">
            <p className="text-label-caps text-outline">Source Site</p>
            {isMasterAdmin ? (
              <>
                <p className="text-body-base text-on-surface">Master Admin: select any site.</p>
                <select className="mt-1 w-full bg-surface border border-outline-variant text-on-surface px-3 py-2 text-body-sm outline-none focus:border-primary"
                  value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
                  <option value="">-- Select a site --</option>
                  {(sites.length > 0 ? sites : DEMO_SITES).map((s) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </>
            ) : canWrite ? (
              <>
                <p className="text-body-base text-on-surface">{effectiveSite?.code} — {effectiveSite?.name}</p>
                <p className="text-body-sm text-on-surface-variant">Drone will be registered to your assigned site ({effectiveSite?.code}).</p>
              </>
            ) : (
              <>
                <p className="text-body-base text-on-surface">{effectiveSite?.code} — {effectiveSite?.name}</p>
                <p className="text-body-sm text-on-surface-variant">Drone will be registered to your operating site.</p>
              </>
            )}
          </div>
        </Card>

        <Input label="Drone Identifier" icon="precision_manufacturing" placeholder="e.g. D-011"
          value={droneId} onChange={(e) => setDroneId(e.target.value)} required
          disabled={submitting || success}
          hint={formErrors.droneId ? `Error: ${formErrors.droneId}` : undefined} />

        {/* Heading From / To — defines the flight corridor */}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Heading From (0-360)" icon="navigation" type="number" min={0} max={360} step={1}
            placeholder="e.g. 310" value={headingFrom} onChange={(e) => setHeadingFrom(e.target.value)} required
            disabled={submitting || success}
            hint={formErrors.headingFrom ? `Error: ${formErrors.headingFrom}` : 'Start of direction range'} />
          <Input label="Heading To (0-360)" icon="navigation" type="number" min={0} max={360} step={1}
            placeholder="e.g. 330" value={headingTo} onChange={(e) => setHeadingTo(e.target.value)} required
            disabled={submitting || success}
            hint={formErrors.headingTo ? `Error: ${formErrors.headingTo}` : 'End of direction range'} />
        </div>

        {/* Flight Direction relative to Site */}
        <div className="space-y-2">
          <label className="text-label-caps text-on-surface-variant">Flight Direction relative to Site</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              className={`p-3 border text-left transition-all ${flightRelation === 'away' ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface-container-low hover:bg-surface-container'}`}
              onClick={() => setFlightRelation('away')}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${flightRelation === 'away' ? 'border-primary' : 'border-outline'}`}>
                  {flightRelation === 'away' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <span className="text-body-sm font-bold text-on-surface">Moving Away</span>
              </div>
              <p className="text-body-sm text-on-surface-variant pl-6">Drone flies away from the Site. Distance increases.</p>
            </button>
            <button
              type="button"
              className={`p-3 border text-left transition-all ${flightRelation === 'approaching' ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface-container-low hover:bg-surface-container'}`}
              onClick={() => setFlightRelation('approaching')}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${flightRelation === 'approaching' ? 'border-primary' : 'border-outline'}`}>
                  {flightRelation === 'approaching' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <span className="text-body-sm font-bold text-on-surface">Approaching Site</span>
              </div>
              <p className="text-body-sm text-on-surface-variant pl-6">Drone flies toward the Site. Distance decreases.</p>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Distance from Site (km)" icon="straighten" type="number" min={0} step={0.1}
            placeholder="e.g. 6" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} required
            disabled={submitting || success}
            hint={formErrors.distanceKm ? `Error: ${formErrors.distanceKm}` : 'Initial distance'} />
          <Input label="Speed (m/s)" icon="speed" type="number" min={0}
            placeholder="e.g. 20" value={speed} onChange={(e) => setSpeed(e.target.value)} required
            disabled={submitting || success} hint={formErrors.speed || undefined} />
          <Input label="Altitude (m)" icon="height" type="number" min={0}
            placeholder="e.g. 200" value={altitude} onChange={(e) => setAltitude(e.target.value)} required
            disabled={submitting || success} hint={formErrors.altitude || undefined} />
        </div>

        {/* Calculated Position */}
        {calculatedPosition && (
          <Card className="p-3 border-l-4" style={{ borderLeftColor: siteColor }}>
            <p className="text-label-caps text-outline mb-1">INITIAL GEOGRAPHIC POSITION</p>
            <p className="text-data-mono text-on-surface">
              {calculatedPosition.latitude.toFixed(6)}° N, {calculatedPosition.longitude.toFixed(6)}° E
            </p>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {distanceMeters.toFixed(0)}m from {effectiveSite?.code} · Initial heading: {deploymentHeading.toFixed(1)}° {dirLabel}
            </p>
            <p className="text-body-sm text-on-surface-variant">
              Flight corridor: {headingFrom}° → {headingTo}° · Dynamic heading within range
            </p>
          </Card>
        )}

        {droneId && effectiveSite && !success && (
          <Card className="p-3 bg-surface-container-low border border-outline-variant">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined" style={{ color: siteColor }}>check_circle</span>
              <div>
                <p className="text-label-caps text-on-surface">Registration Summary</p>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  {droneId} → {effectiveSite?.code} ·
                  HDG: {headingFrom || '?'}°–{headingTo || '?'}° · {distanceKm || '?'}km ·
                  SPD: {speed || '?'} m/s · ALT: {altitude || '?'}m
                </p>
                <p className="text-label-caps text-[10px] text-primary mt-1">
                  Flight corridor {headingFrom}°–{headingTo}° · Dynamic heading within range · Position updates every 250ms
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-surface-container md:static md:bg-transparent">
          <Button variant="secondary" type="button" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" icon={success ? 'check' : 'add_circle'} disabled={submitting || success}>
            {submitting ? 'Registering...' : success ? 'Registered!' : 'Register Drone'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
