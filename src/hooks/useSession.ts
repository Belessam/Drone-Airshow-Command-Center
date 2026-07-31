/**
 * useSession — manages the active device session lifecycle.
 *
 * On login: registers device, creates session, starts heartbeat.
 * On reload: restores last session, sends heartbeat.
 * On forced logout: redirects to login.
 * On device block: disconnects immediately.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './useAuth'
import { useNavigate } from 'react-router-dom'
import {
  initSession,
  logoutSession,
  setSessionToken,
  getSessionToken,
  onForcedLogout,
  stopHeartbeat,
} from '@/lib/session/sessionService'

interface UseSessionReturn {
  needsDeviceName: boolean
  pendingDeviceId: string | null
  sessionReady: boolean
  acknowledgeDeviceName: () => void
}

// Track whether session was initialized for the current user
let sessionInitializedForUserId: string | null = null

export function useSession(): UseSessionReturn {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [needsDeviceName, setNeedsDeviceName] = useState(false)
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const initInProgress = useRef(false)

  // Listen for forced logout
  useEffect(() => {
    onForcedLogout((reason) => {
      stopHeartbeat()
      navigate('/login', { state: { forcedLogout: reason } })
    })
  }, [navigate])

  const initializeSession = useCallback(async (userId: string) => {
    if (initInProgress.current) return
    initInProgress.current = true

    try {
      // Check if we already have a session token for this user
      const existingToken = getSessionToken()
      if (existingToken && sessionInitializedForUserId === userId) {
        setSessionReady(true)
        initInProgress.current = false
        return
      }

      const result = await initSession(userId)
      sessionInitializedForUserId = userId
      setSessionReady(true)

      if (result.needsDeviceName) {
        setNeedsDeviceName(true)
        setPendingDeviceId(result.device.deviceId)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Session initialization failed'
      if (message.includes('blocked')) {
        navigate('/login', { state: { blocked: true } })
      } else {
        console.error('[SESSION] Init failed:', message)
        // Session init failed but auth succeeded — still allow access
        setSessionReady(true)
      }
    } finally {
      initInProgress.current = false
    }
  }, [navigate])

  // Init session when user becomes available
  useEffect(() => {
    if (loading) return
    if (!user) {
      // Not logged in — clean up
      sessionInitializedForUserId = null
      setSessionReady(false)
      return
    }
    // Skip session init in demo mode
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      setSessionReady(true)
      return
    }
    initializeSession(user.id)
  }, [user, loading, initializeSession])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't stop heartbeat on unmount — it continues for page navigation
    }
  }, [])

  const acknowledgeDeviceName = useCallback(() => {
    setNeedsDeviceName(false)
    setPendingDeviceId(null)
  }, [])

  return { needsDeviceName, pendingDeviceId, sessionReady, acknowledgeDeviceName }
}
