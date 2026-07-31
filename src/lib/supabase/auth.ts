/**
 * Auth service — encapsulates all Supabase Auth interactions.
 * Supports username-based login (resolves username → email via profiles table).
 *
 * In production:
 *   username → profiles.username → auth.users.email → signInWithPassword
 *
 * In demo mode:
 *   username → demoLogin()
 */

import { supabase } from './client'
import type { Profile, UserRole, Site } from '@/types'
import { fetchProfile } from './queries'
import { demoLogin, isDemoMode, DEMO_USERS } from '@/utils/demoMode'

export interface AuthSession {
  user: Profile | null
  session: any | null
}

// Demo-mode username-to-email mapping (matches the 6 production accounts)
const DEMO_USERNAME_MAP: Record<string, string> = {
  masterofeyes: 'masterofeyes@system.mil',
  '815avenger': '815avenger@system.mil',
  '817avenger': '817avenger@system.mil',
  '821avenger': '821avenger@system.mil',
  '586pechora': '586pechora@system.mil',
  'HARES': 'hares@system.mil',
  'smartguard': 'hares@system.mil',
}

/**
 * Resolve a username to an email address for Supabase Auth.
 * Does NOT expose whether a username exists — returns null for unknown.
 * Uses the profiles table (secured by RLS).
 */
async function resolveUsername(username: string): Promise<string | null> {
  if (isDemoMode()) {
    return DEMO_USERNAME_MAP[username] || username + '@demo.mil'
  }

  try {
    // First try matching by username
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', username)
      .eq('is_active', true)
      .maybeSingle()

    if (!error && data) return data.email

    // If not found by username, check if input looks like an email and try matching by email
    if (username.includes('@')) {
      const { data: emailData, error: emailError } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', username.toLowerCase().trim())
        .eq('is_active', true)
        .maybeSingle()

      if (!emailError && emailData) return emailData.email
    }

    return null
  } catch {
    return null
  }
}

/**
 * Get the current auth session, restoring from stored token if available.
 */
export async function getSession(): Promise<AuthSession> {
  if (isDemoMode()) {
    const prof = demoLogin('masterofeyes@system.mil')
    return { user: prof, session: null }
  }

  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    return { user: null, session: null }
  }

  const profile = await fetchProfile(session.user.id)

  // If the Supabase profile has no site_id, fill from DEMO_USERS.
  // Matches against: auth email, profile email, or profile username (case-insensitive).
  // Also persists the fix to the DB so subsequent refreshes work without fallback.
  if (profile && !profile.site_id) {
    const authEmail = session.user.email?.toLowerCase()
    const profEmail = profile.email?.toLowerCase()
    const profUsername = profile.username?.toLowerCase()
    const demoUser = DEMO_USERS.find((u) => {
      if (authEmail && u.email.toLowerCase() === authEmail) return true
      if (profEmail && u.email.toLowerCase() === profEmail) return true
      if (profUsername && u.username?.toLowerCase() === profUsername) return true
      return false
    })
    if (demoUser?.site_id) {
      profile.site_id = demoUser.site_id
      // Persist to DB so subsequent refreshes work without fallback
      supabase.from('profiles').update({ site_id: demoUser.site_id }).eq('id', profile.id).then(({ error }) => {
        if (!error) console.log('[AUTH] Persisted site_id', demoUser.site_id, 'for', profile.username)
      })
    }
  }

  return { user: profile, session }
}

/**
 * Sign in with username and password.
 * Resolves username → email → Supabase Auth signInWithPassword.
 */
export async function signInWithEmail(username: string, password: string): Promise<AuthSession> {
  if (!username || !password) {
    throw new Error('Username and access key are required.')
  }

  if (isDemoMode()) {
    const mappedEmail = DEMO_USERNAME_MAP[username] || `${username}@demo.mil`
    const demoProfile = demoLogin(mappedEmail)
    if (!demoProfile) {
      throw new Error('Invalid credentials.')
    }
    return { user: demoProfile, session: null }
  }

  // Resolve username to email via profiles table
  const email = await resolveUsername(username)
  if (!email) {
    throw new Error('Invalid username or access key.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  let profile: Profile | null = null
  if (data.user) {
    for (let i = 0; i < 5; i++) {
      try {
        profile = await fetchProfile(data.user.id)
      } catch (err) {
        console.error('[AUTH] Profile fetch error (attempt ' + (i + 1) + '):', err)
      }
      if (profile) break
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  if (!profile) {
    console.warn('[AUTH] Authentication succeeded but profile could not be loaded for user:', data.user.id)
    throw new Error('Authentication succeeded, but your profile could not be loaded. Please contact an administrator.')
  }

  // If the Supabase profile has no site_id, try to fill it from demo data
  // This handles the case where migrations haven't been run yet.
  // Matches against: resolved email, profile email, input username, profile username (all case-insensitive).
  if (!profile.site_id) {
    const profEmail = profile.email?.toLowerCase()
    const profUsername = profile.username?.toLowerCase()
    const inputLower = username.toLowerCase()
    const demoUser = DEMO_USERS.find((u) => {
      if (email && u.email.toLowerCase() === email) return true
      if (profEmail && u.email.toLowerCase() === profEmail) return true
      if (inputLower && u.username?.toLowerCase() === inputLower) return true
      if (profUsername && u.username?.toLowerCase() === profUsername) return true
      return false
    })
    if (demoUser?.site_id) {
      profile.site_id = demoUser.site_id
      // Persist to DB so subsequent refreshes work without fallback
      supabase.from('profiles').update({ site_id: demoUser.site_id }).eq('id', profile.id).then(({ error }) => {
        if (!error) console.log('[AUTH] Persisted site_id', demoUser.site_id, 'for', profile.username)
      })
    }
  }

  return { user: profile, session: data.session }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  if (isDemoMode()) return
  await supabase.auth.signOut()
}

/**
 * Listen for auth state changes.
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  if (isDemoMode()) return { subscription: { unsubscribe: () => {} } }
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return { subscription }
}

// ================================================================
// RBAC Permission Helpers
// ================================================================

const ROLE_HIERARCHY: Record<UserRole, number> = {
  master_admin: 100,
  admin: 80,
  site_operator: 50,
  viewer: 10,
}

export function hasMinimumRole(user: Profile | null, minimumRole: UserRole): boolean {
  if (!user) return false
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minimumRole]
}

export function hasRole(user: Profile | null, ...roles: UserRole[]): boolean {
  if (!user) return false
  return roles.includes(user.role)
}

export function canManageSite(user: Profile | null, siteId: string): boolean {
  if (!user) return false
  if (user.role === 'master_admin') return true
  // Admin and site_operator can only manage their OWN assigned site
  if ((user.role === 'admin' || user.role === 'site_operator') && user.site_id === siteId) return true
  return false
}

export function canWrite(user: Profile | null): boolean {
  if (!user) return false
  return user.role === 'master_admin' || user.role === 'admin' || user.role === 'site_operator'
}

export function canManageSites(user: Profile | null): boolean {
  return user?.role === 'master_admin'
}

export function canManageUsers(user: Profile | null): boolean {
  return user?.role === 'master_admin'
}

export function canManageSettings(user: Profile | null): boolean {
  return user?.role === 'master_admin'
}

export function getRoleDisplay(role: UserRole): { label: string; color: string } {
  switch (role) {
    case 'master_admin': return { label: 'Master Admin', color: '#EF4444' }
    case 'admin': return { label: 'System Admin', color: '#F2994A' }
    case 'site_operator': return { label: 'Site Operator', color: '#2F80ED' }
    case 'viewer': return { label: 'Viewer', color: '#8b919f' }
  }
}

// ================================================================
// Centralized Drone Permission Helpers
// ================================================================

/**
 * Can a user manage (edit/delete) a specific drone?
 * Master admin can manage ALL drones.
 * Admins and site_operators can only manage drones belonging to their assigned site.
 */
export function canManageDrone(user: Profile | null, droneSourceSiteId: string): boolean {
  if (!user) return false
  if (user.role === 'master_admin') return true
  return user.site_id === droneSourceSiteId
}

/**
 * Can a user create a drone for a given site?
 * Master admin can create for any site.
 * Others can only create for their own assigned site.
 */
export function canCreateDroneForSite(user: Profile | null, targetSiteId: string): boolean {
  if (!user) return false
  if (user.role === 'master_admin') return true
  return user.site_id === targetSiteId
}
