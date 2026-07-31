import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Drone } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useDronesData } from '@/hooks/useDronesData'
import { simulationRunner } from '@/lib/simulation/runner'
import { isDemoMode } from '@/utils/demoMode'
import { mockSites } from '@/utils/mockData'
import { validateDroneForm } from '@/utils/validation'

interface UpdateDroneModalProps {
  isOpen: boolean
  onClose: () => void
  drone: Drone
}

export function UpdateDroneModal({ isOpen, onClose, drone }: UpdateDroneModalProps) {
  const { user, canManageSite } = useAuth()
  const { updateDrone } = useDronesData()

  const site = isDemoMode()
    ? mockSites.find((s) => s.id === drone.source_site_id)
    : undefined

  const siteColor = site?.color || '#abc7ff'

  const [latitude, setLatitude] = useState(String(drone.last_confirmed_latitude))
  const [longitude, setLongitude] = useState(String(drone.last_confirmed_longitude))
  const [altitude, setAltitude] = useState(String(drone.last_confirmed_altitude))
  const [heading, setHeading] = useState(String(drone.heading))
  const [speed, setSpeed] = useState(String(drone.speed_mps))
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Get estimated position from the simulation runner (site-relative)
  const runnerPos = simulationRunner.getPosition(drone.id)
  const estimatedLat = runnerPos?.latitude ?? drone.last_confirmed_latitude
  const estimatedLng = runnerPos?.longitude ?? drone.last_confirmed_longitude

  const canUpdate = canManageSite(drone.source_site_id)

  const handleClose = () => {
    setFormErrors({})
    setSubmitError(null)
    setSuccess(false)
    setSubmitting(false)
    setNotes('')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canUpdate) return
    setFormErrors({})
    setSubmitError(null)

    const validation = validateDroneForm({ latitude, longitude, heading, speed, altitude })
    if (!validation.valid) {
      setFormErrors(validation.errors)
      return
    }

    setSubmitting(true)
    try {
      const result = await updateDrone({
        drone_id: drone.id,
        site_id: drone.source_site_id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        altitude: parseFloat(altitude),
        heading: parseFloat(heading),
        speed_mps: parseFloat(speed),
        notes: notes || null,
        user_id: user?.id ?? null,
      })

      if (result) {
        setSuccess(true)
        setTimeout(handleClose, 1200)
      } else {
        setSubmitError('Failed to update drone. Please try again.')
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Manual Update — ${drone.drone_id}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Success feedback */}
        {success && (
          <div className="bg-[#27AE60]/10 border border-[#27AE60]/30 p-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#27AE60]">check_circle</span>
            <p className="text-body-sm text-[#27AE60] font-medium">
              Drone {drone.drone_id} updated successfully!
            </p>
          </div>
        )}

        {/* Error feedback */}
        {submitError && (
          <div className="bg-error-container/10 border border-error/30 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-error text-sm mt-0.5">error</span>
            <p className="text-body-sm text-on-error-container">{submitError}</p>
          </div>
        )}

        {/* Permission warning */}
        {!canUpdate && !success && (
          <Card className="p-3 border-l-4" style={{ borderLeftColor: '#EF4444' }}>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error mt-0.5">lock</span>
              <div>
                <p className="text-label-caps text-error mb-1">Insufficient Permissions</p>
                <p className="text-body-sm text-on-surface-variant">
                  You do not have permission to update this drone. Only the source site operator or an admin can perform updates.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Archive Preview */}
        <Card className="p-4 border-l-4" style={{ borderLeftColor: '#F2994A' }}>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#F2994A] mt-0.5">history</span>
            <div>
              <p className="text-label-caps text-[#F2994A] mb-1">Current Simulation Will Be Archived</p>
              <p className="text-body-sm text-on-surface-variant">
                The current simulation segment will end at the estimated position below.
                A new segment will begin from the new confirmed coordinates.
              </p>
            </div>
          </div>
        </Card>

        {/* Current state preview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-3">
            <p className="text-label-caps text-outline mb-2">CURRENT ESTIMATED POSITION</p>
            <p className="text-data-mono text-on-surface-variant">{estimatedLat.toFixed(6)}° N</p>
            <p className="text-data-mono text-on-surface-variant">{Math.abs(estimatedLng).toFixed(6)}° W</p>
            <p className="text-label-caps text-[10px] text-outline mt-1">Simulation will stop here</p>
          </Card>
          <Card className="p-3">
            <p className="text-label-caps text-outline mb-2">CURRENT CONFIRMED</p>
            <p className="text-data-mono text-on-surface">{drone.last_confirmed_latitude.toFixed(6)}° N</p>
            <p className="text-data-mono text-on-surface">{Math.abs(drone.last_confirmed_longitude).toFixed(6)}° W</p>
            <p className="text-label-caps text-[10px] text-outline mt-1">Last confirmed at {new Date(drone.last_confirmed_at).toLocaleTimeString()}</p>
          </Card>
        </div>

        {/* Source Site Info */}
        <Card className="p-3 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: siteColor }} />
          <div>
            <p className="text-label-caps text-outline">Source Site</p>
            <p className="text-body-base text-on-surface">{site?.code || drone.source_site_id} — {site?.name || 'Unknown'}</p>
          </div>
        </Card>

        {/* Update Form */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Latitude"
            icon="explore"
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            required
            disabled={!canUpdate || submitting || success}
            hint={formErrors.latitude || undefined}
          />
          <Input
            label="Longitude"
            icon="explore"
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            required
            disabled={!canUpdate || submitting || success}
            hint={formErrors.longitude || undefined}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Heading (°)"
            icon="navigation"
            type="number"
            min={0}
            max={360}
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            required
            disabled={!canUpdate || submitting || success}
            hint={formErrors.heading || undefined}
          />
          <Input
            label="Speed (m/s)"
            icon="speed"
            type="number"
            min={0}
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            required
            disabled={!canUpdate || submitting || success}
            hint={formErrors.speed || undefined}
          />
          <Input
            label="Altitude (m)"
            icon="height"
            type="number"
            min={0}
            value={altitude}
            onChange={(e) => setAltitude(e.target.value)}
            required
            disabled={!canUpdate || submitting || success}
            hint={formErrors.altitude || undefined}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-label-caps text-on-surface-variant">Notes</label>
          <textarea
            className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-body-base p-3 outline-none focus:border-primary transition-all resize-none"
            rows={3}
            placeholder="Optional update notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canUpdate || submitting || success}
          />
        </div>

        {/* Post-update preview */}
        <Card className="p-4 border-l-4" style={{ borderLeftColor: siteColor }}>
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined" style={{ color: siteColor }}>play_circle</span>
            <div>
              <p className="text-label-caps" style={{ color: siteColor }}>New Simulation Will Start</p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                After saving, the simulation will restart from the new confirmed position
                using HDG: {heading}° · SPD: {speed} m/s · ALT: {altitude}m
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={success ? 'check' : 'save'}
            disabled={!canUpdate || submitting || success}
          >
            {submitting ? 'Saving...' : success ? 'Updated!' : 'Save Update'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
