/**
 * Session Management Service — handles device registration, heartbeat,
 * session lifecycle, and blocked device detection through Supabase.
 *
 * Architecture:
 *   Login → register device → create session → start heartbeat loop
 *   Session token stored in memory (never localStorage)
 *   Heartbeat every 30s updates last_activity, current_page, status
 *   On reload: exchange stored session token for new heartbeat
 */

import { supabase } from '@/lib/supabase/client'
import { collectDeviceFingerprint, type DeviceFingerprint } from './fingerprint'

// ─── Types ───

export interface SessionInfo {
  id: string
  userId: string
  deviceId: string
  sessionToken: string
  ipAddress?: string
  country?: string
  city?: string
  loginTime: string
  lastActivity: string
  currentPage: string
  status: 'online' | 'idle' | 'offline'
  isRevoked: boolean
}

/**
 * Map a raw PostgREST row (snake_case columns) to the camelCase SessionInfo
 * shape used by the UI. supabase-js v2 does NOT transform column names, so
 * without this the Active Sessions dashboard would read undefined fields.
 */
export function mapSessionRow(row: any): SessionInfo {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    sessionToken: row.session_token,
    ipAddress: row.ip_address ?? undefined,
    country: row.country ?? undefined,
    city: row.city ?? undefined,
    loginTime: row.login_time,
    lastActivity: row.last_activity,
    currentPage: row.current_page,
    status: row.status,
    isRevoked: row.is_revoked,
  }
}

export interface DeviceInfo {
  id: string
  deviceId: string
  deviceName: string
  browser?: string
  browserVersion?: string
  os?: string
  platform?: string
  language?: string
  timezone?: string
  screenResolution?: string
  firstSeen: string
  lastSeen: string
  isBlocked: boolean
}

export interface LoginHistoryEntry {
  id: string
  userId?: string
  username?: string
  eventType: 'login' | 'logout' | 'forced_logout' | 'blocked' | 'failed_login'
  deviceId?: string
  deviceName?: string
  ipAddress?: string
  browser?: string
  country?: string
  city?: string
  failureReason?: string
  createdAt: string
}

export interface DashboardStats {
  activeAccounts: number
  activeSessions: number
  onlineDevices: number
  idleDevices: number
  offlineDevices: number
  blockedDevices: number
  todayLogins: number
  todayFailedLogins: number
}

// ─── Public IP capture (server-side on Vercel) ───

let _publicIpCache: string | null = null

/**
 * Resolve the caller's public IP via the serverless route /api/session/ip.
 * Results are cached in memory for the lifetime of the page so the
 * heartbeat does not re-fetch on every tick. Falls back to '' silently
 * when the route is unavailable (local dev without the Vite proxy).
 */
export async function fetchPublicIp(): Promise<string> {
  if (_publicIpCache !== null) return _publicIpCache
  try {
    const res = await fetch('/api/session/ip')
    if (!res.ok) return ''
    const data = await res.json() as { ip?: unknown }
    const ip = typeof data.ip === 'string' ? data.ip : ''
    _publicIpCache = ip
    return ip
  } catch {
    return ''
  }
}

// ─── In-memory session token (never persisted to localStorage) ───

let _sessionToken: string | null = null
let _currentSessionId: string | null = null
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null
let _lastActivityTime = Date.now()

// ─── Activity tracking ───

export function trackActivity(): void {
  _lastActivityTime = Date.now()
}

// Attach activity listeners globally
if (typeof window !== 'undefined') {
  ;['click', 'keydown', 'touchstart', 'mousemove', 'scroll'].forEach(evt =>
    window.addEventListener(evt, trackActivity, { passive: true })
  )
}

// ─── Session Token (memory-only) ───

export function getSessionToken(): string | null {
  return _sessionToken
}

export function setSessionToken(token: string | null): void {
  _sessionToken = token
}

export function getCurrentSessionId(): string | null {
  return _currentSessionId
}

// ─── Init Session on Login ───

export interface InitSessionResult {
  session: SessionInfo
  device: DeviceInfo
  needsDeviceName: boolean
}

/**
 * Initialize a new session after login.
 * 1. Collects device fingerprint
 * 2. Registers/updates device in session_devices
 * 3. Creates active session row
 * 4. Inserts login history
 * 5. Starts heartbeat
 */
export async function initSession(userId: string): Promise<InitSessionResult> {
  const fingerprint = await collectDeviceFingerprint()

  // 1. Check if device is blocked
  const { data: blocked } = await supabase
    .from('session_devices')
    .select('is_blocked, device_name')
    .eq('device_id', fingerprint.deviceId)
    .single()

  if (blocked?.is_blocked) {
    // Log the blocked attempt
    await supabase.from('login_history').insert({
      user_id: userId,
      event_type: 'blocked',
      device_id: fingerprint.deviceId,
      ip_address: '',
      browser: fingerprint.browser,
      failure_reason: 'Device is blocked by Master Administrator',
    })
    throw new Error('This device has been blocked by the Master Administrator.')
  }

  // 2. Upsert device registry
  const { data: device, error: devErr } = await supabase
    .from('session_devices')
    .upsert({
      device_id: fingerprint.deviceId,
      browser: fingerprint.browser,
      browser_version: fingerprint.browserVersion,
      os: fingerprint.os,
      platform: fingerprint.platform,
      language: fingerprint.language,
      timezone: fingerprint.timezone,
      screen_resolution: fingerprint.screenResolution,
      user_agent: fingerprint.userAgent,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'device_id', ignoreDuplicates: false })
    .select()
    .single()

  if (devErr) throw new Error(`Device registration failed: ${devErr.message}`)

  const needsDeviceName = !device.device_name || device.device_name === 'Unknown Device'

  // 2b. Mark any previously-active sessions for this device as offline BEFORE
  // creating the new one. Because the session token is held in memory only,
  // a full page reload loses it and would otherwise leave a ghost "online"
  // row while the new session is created — inflating the Active Sessions
  // dashboard. Stale rows are preserved for audit but no longer look live.
  try {
    await supabase
      .from('active_sessions')
      .update({ status: 'offline', is_revoked: true, revoked_at: new Date().toISOString(), revoked_by: userId })
      .eq('device_id', fingerprint.deviceId)
      .eq('user_id', userId)
      .eq('is_revoked', false)
      .eq('status', 'online')
  } catch {}

  // 3. Create active session (ip_address/country/city resolved via Vercel route)
  const sessionToken = crypto.randomUUID()
  const publicIp = await fetchPublicIp()
  const { data: session, error: sessErr } = await supabase
    .from('active_sessions')
    .insert({
      user_id: userId,
      device_id: fingerprint.deviceId,
      session_token: sessionToken,
      status: 'online',
      ip_address: publicIp || null,
    })
    .select()
    .single()

  if (sessErr) throw new Error(`Session creation failed: ${sessErr.message}`)

  // 4. Store in memory
  _sessionToken = sessionToken
  _currentSessionId = session.id
  _lastActivityTime = Date.now()

  // 5. Log login event
  await supabase.from('login_history').insert({
    user_id: userId,
    event_type: 'login',
    device_id: fingerprint.deviceId,
    device_name: device.device_name,
    browser: fingerprint.browser,
  })

  // 6. Start heartbeat
  startHeartbeat()

  return {
    session: session as SessionInfo,
    device: device as DeviceInfo,
    needsDeviceName,
  }
}

// ─── Set Device Name ───

export async function setDeviceName(deviceId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('session_devices')
    .update({ device_name: name })
    .eq('device_id', deviceId)

  if (error) throw new Error(`Failed to set device name: ${error.message}`)
}

export async function renameDevice(deviceId: string, newName: string): Promise<void> {
  await setDeviceName(deviceId, newName)
}

// ─── Heartbeat ───

export function getCurrentPage(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname + window.location.search
}

async function sendHeartbeat(): Promise<void> {
  if (!_sessionToken || !_currentSessionId) return

  const now = Date.now()
  const idleThreshold = 5 * 60 * 1000 // 5 minutes
  const elapsed = now - _lastActivityTime
  const status = elapsed > idleThreshold ? 'idle' : 'online'
  const currentPage = getCurrentPage()

  // Only update changed fields
  const updates: Record<string, any> = {
    last_activity: new Date().toISOString(),
    status,
  }
  if (currentPage) updates.current_page = currentPage

  // Request the affected rows back so a revoked session (0 rows matched)
  // is distinguishable from a generic error. Without .select(), a revoked
  // session's heartbeat succeeds silently and auto-logout never fires.
  const { error, data } = await supabase
    .from('active_sessions')
    .update(updates)
    .eq('id', _currentSessionId)
    .eq('session_token', _sessionToken)
    .eq('is_revoked', false)
    .select('id')

  if (error) {
    // If session was revoked, log out
    if (error.code === 'PGRST116' || error.message?.includes('row')) {
      await forceLogout('Your session has been revoked by the Master Administrator.')
    }
    return
  }

  // Session no longer matches (revoked) — the update returned 0 rows.
  if (!data || data.length === 0) {
    await forceLogout('Your session has been revoked by the Master Administrator.')
    return
  }

  // Insert heartbeat log (sampled every 2nd heartbeat to reduce writes)
  if (Math.random() < 0.5) {
    try {
      const { data: u } = await supabase.auth.getUser()
      await supabase.from('heartbeat_logs').insert({
        session_id: _currentSessionId,
        user_id: u?.user?.id,
        current_page: currentPage,
        status,
      })
    } catch {} // Fire-and-forget
  }
}

export function startHeartbeat(): void {
  if (_heartbeatInterval) return
  // Send immediately, then every 30s
  sendHeartbeat()
  _heartbeatInterval = setInterval(sendHeartbeat, 30_000)
}

export function stopHeartbeat(): void {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval)
    _heartbeatInterval = null
  }
}

// ─── Logout ───

export async function logoutSession(): Promise<void> {
  if (_currentSessionId && _sessionToken) {
    try {
      const { data: u } = await supabase.auth.getUser()
      await supabase.from('login_history').insert({
        user_id: u?.user?.id,
        event_type: 'logout',
        device_id: (await getDeviceId()) ?? undefined,
      })
    } catch {}

    try {
      await supabase
        .from('active_sessions')
        .update({ is_revoked: true, status: 'offline', revoked_at: new Date().toISOString() })
        .eq('id', _currentSessionId)
    } catch {}
  }

  stopHeartbeat()
  _sessionToken = null
  _currentSessionId = null
}

async function getDeviceId(): Promise<string | null> {
  try {
    const fp = await collectDeviceFingerprint()
    return fp.deviceId
  } catch { return null }
}

// ─── Forced logout handler ───

let _forcedLogoutHandler: ((reason: string) => void) | null = null

export function onForcedLogout(handler: (reason: string) => void): void {
  _forcedLogoutHandler = handler
}

async function forceLogout(reason: string): Promise<void> {
  stopHeartbeat()
  _sessionToken = null
  _currentSessionId = null
  _forcedLogoutHandler?.(reason)
}

// ─── Master Admin: Session Management ───

export async function fetchAllSessions(): Promise<SessionInfo[]> {
  const { data, error } = await supabase
    .from('active_sessions')
    .select('*, profiles!inner(username, role, site_id)')
    .order('login_time', { ascending: false })

  if (error) throw error
  // Preserve the joined profile object alongside the mapped session fields.
  return (data || []).map((row: any) => ({
    ...mapSessionRow(row),
    profiles: row.profiles,
  })) as any
}

export async function fetchDevices(): Promise<DeviceInfo[]> {
  const { data, error } = await supabase
    .from('session_devices')
    .select('*')
    .order('last_seen', { ascending: false })

  if (error) throw error
  return (data || []).map((row: any) => ({
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    browser: row.browser ?? undefined,
    browserVersion: row.browser_version ?? undefined,
    os: row.os ?? undefined,
    platform: row.platform ?? undefined,
    language: row.language ?? undefined,
    timezone: row.timezone ?? undefined,
    screenResolution: row.screen_resolution ?? undefined,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    isBlocked: row.is_blocked,
  })) as DeviceInfo[]
}

export async function revokeSession(sessionId: string, revokedBy: string): Promise<void> {
  await supabase
    .from('active_sessions')
    .update({ is_revoked: true, status: 'offline', revoked_at: new Date().toISOString(), revoked_by: revokedBy })
    .eq('id', sessionId)
}

export async function revokeAllUserSessions(userId: string, revokedBy: string): Promise<void> {
  await supabase
    .from('active_sessions')
    .update({ is_revoked: true, status: 'offline', revoked_at: new Date().toISOString(), revoked_by: revokedBy })
    .eq('user_id', userId)
    .eq('is_revoked', false)
}

export async function blockDevice(deviceId: string, blockedBy: string): Promise<void> {
  await supabase
    .from('session_devices')
    .update({ is_blocked: true, blocked_at: new Date().toISOString(), blocked_by: blockedBy })
    .eq('device_id', deviceId)
  // Revoke all active sessions for this device
  await supabase
    .from('active_sessions')
    .update({ is_revoked: true, status: 'offline', revoked_at: new Date().toISOString(), revoked_by: blockedBy })
    .eq('device_id', deviceId)
    .eq('is_revoked', false)
}

export async function unblockDevice(deviceId: string): Promise<void> {
  await supabase
    .from('session_devices')
    .update({ is_blocked: false, blocked_at: null, blocked_by: null })
    .eq('device_id', deviceId)
}

export async function fetchLoginHistory(options?: {
  userId?: string
  limit?: number
  since?: string
}): Promise<LoginHistoryEntry[]> {
  let query = supabase
    .from('login_history')
    .select('*, profiles!inner(username)')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100)

  if (options?.userId) query = query.eq('user_id', options.userId)
  if (options?.since) query = query.gte('created_at', options.since)

  const { data, error } = await query
  if (error) throw error
  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id ?? undefined,
    username: row.username ?? undefined,
    eventType: row.event_type,
    deviceId: row.device_id ?? undefined,
    deviceName: row.device_name ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    browser: row.browser ?? undefined,
    country: row.country ?? undefined,
    city: row.city ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    createdAt: row.created_at,
    profiles: row.profiles,
  })) as any
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Note: counts are computed in JS from filtered selects. Combining
  // `.count('exact')` with a `.gte()` filter in one request produced a broken
  // PostgREST query (PGRST205) — splitting into simple filtered selects and
  // counting locally is reliable and identical in result.
  const [sessionsRes, devicesRes, userSessionsRes, todayLoginsRes] = await Promise.all([
    supabase.from('active_sessions').select('id, status, is_revoked').eq('is_revoked', false),
    supabase.from('session_devices').select('id, is_blocked'),
    supabase.from('active_sessions').select('user_id').eq('is_revoked', false),
    supabase.from('login_history').select('event_type').gte('created_at', today.toISOString()),
  ])

  const activeSessions = sessionsRes.data || []
  const onlineDevices = activeSessions.filter(s => s.status === 'online').length
  const idleDevices = activeSessions.filter(s => s.status === 'idle').length

  // Count unique users with active sessions
  const uniqueUsers = new Set((userSessionsRes.data || []).map(s => s.user_id))

  // Today's logins
  const todayLogins = todayLoginsRes.data || []
  const loginCount = todayLogins.filter(e => e.event_type === 'login').length
  const failedCount = todayLogins.filter(e => e.event_type === 'failed_login').length
  const blockedCount = (devicesRes.data || []).filter(d => d.is_blocked).length

  return {
    activeAccounts: uniqueUsers.size,
    activeSessions: activeSessions.length,
    onlineDevices: onlineDevices,
    idleDevices: idleDevices,
    offlineDevices: activeSessions.length - onlineDevices - idleDevices,
    blockedDevices: blockedCount,
    todayLogins: loginCount,
    todayFailedLogins: failedCount,
  }
}
