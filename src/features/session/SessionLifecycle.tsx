import { useEffect } from 'react'
import { useSession } from '@/hooks/useSession'
import { DeviceNameModal } from './DeviceNameModal'

/**
 * SessionLifecycle — mounts the active-session lifecycle once at the app root.
 *
 * Wires the session heartbeat / device registration / forced-logout handling
 * into the running app. Without this, initSession is never called and no
 * active_sessions rows are ever created, so the Master Admin's Active Sessions
 * dashboard stays empty.
 *
 * Renders nothing visible (null) — its only job is to drive the session hook.
 * In demo mode useSession() no-ops (see hook), so this is safe in both modes.
 */
export function SessionLifecycle() {
  const { needsDeviceName, pendingDeviceId, sessionReady, acknowledgeDeviceName } = useSession()

  useEffect(() => {
    if (!sessionReady) return
    // Session is initialized (or demo mode). Nothing to render.
  }, [sessionReady])

  if (needsDeviceName && pendingDeviceId) {
    return (
      <DeviceNameModal
        isOpen={true}
        deviceId={pendingDeviceId}
        onComplete={acknowledgeDeviceName}
      />
    )
  }

  return null
}
