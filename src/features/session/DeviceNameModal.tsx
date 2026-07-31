import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { setDeviceName } from '@/lib/session/sessionService'

interface DeviceNameModalProps {
  isOpen: boolean
  deviceId: string
  onComplete: () => void
}

export function DeviceNameModal({ isOpen, deviceId, onComplete }: DeviceNameModalProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await setDeviceName(deviceId, name.trim())
      onComplete()
    } catch (err) {
      console.error('[DEVICE NAME] Failed to save:', err)
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => {}} title="Name This Device" size="sm">
      <div className="space-y-4">
        <p className="text-body-sm text-on-surface-variant">
          First login from this device. Enter a descriptive name to identify it in the session manager.
        </p>
        <div className="space-y-1.5">
          <label className="text-label-caps text-on-surface-variant">Device Name</label>
          <input
            type="text"
            className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-data-mono py-2.5 px-3 text-sm outline-none focus:border-primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Operations Room PC"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="primary" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? 'Saving...' : 'Save Device Name'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
