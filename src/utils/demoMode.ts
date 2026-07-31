/**
 * Demo mode — provides realistic multi-site authentication and data.
 *
 * Five independent sites:
 *   SITE-01 through SITE-05
 *
 * All sites share the same global drone state.
 */

import type { Profile, Site } from '@/types'

export function isDemoMode(): boolean {
  // Only explicit VITE_DEMO_MODE=true enables demo mode.
  // In production, this must be explicitly set to "false".
  // NEVER silently default to true — that would break production auth.
  const demo = import.meta.env.VITE_DEMO_MODE
  return demo === 'true'
}

export const DEMO_SITES: Site[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'SITE-01',
    code: 'SITE-01',
    color: '#2F80ED',
    latitude: 30.0444,
    longitude: 31.2357,
    radius_km: 15.0,
    description: 'Primary operations center.',
    is_active: true,
    gps_accuracy: 5.0,
    location_verified: true,
    location_verified_at: '2026-07-01T00:00:00Z',
    address: 'Sector Alpha',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'SITE-02',
    code: 'SITE-02',
    color: '#27AE60',
    latitude: 24.7136,
    longitude: 46.6753,
    radius_km: 15.0,
    description: 'Northern operations hub.',
    is_active: true,
    gps_accuracy: 5.0,
    location_verified: true,
    location_verified_at: '2026-07-01T00:00:00Z',
    address: 'Sector Bravo',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name: 'SITE-03',
    code: 'SITE-03',
    color: '#F2994A',
    latitude: 25.2048,
    longitude: 55.2708,
    radius_km: 15.0,
    description: 'Eastern surveillance station.',
    is_active: true,
    gps_accuracy: 5.0,
    location_verified: true,
    location_verified_at: '2026-07-01T00:00:00Z',
    address: 'Sector Charlie',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    name: 'SITE-04',
    code: 'SITE-04',
    color: '#9B51E0',
    latitude: 25.2867,
    longitude: 55.2967,
    radius_km: 10.0,
    description: 'Southern coastal entry point.',
    is_active: true,
    gps_accuracy: 10.0,
    location_verified: true,
    location_verified_at: '2026-07-01T00:00:00Z',
    address: 'Sector Delta',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    name: 'SITE-05',
    code: 'SITE-05',
    color: '#56CCF2',
    latitude: 24.4539,
    longitude: 54.3773,
    radius_km: 10.0,
    description: 'Western outpost.',
    is_active: true,
    gps_accuracy: 10.0,
    location_verified: true,
    location_verified_at: '2026-07-01T00:00:00Z',
    address: 'Sector Echo',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
]

/** Demo users — all 6 production accounts with correct roles */
export const DEMO_USERS: Profile[] = [
  {
    id: 'demo-master',
    email: 'masterofeyes@system.mil',
    username: 'masterofeyes',
    full_name: 'Master Admin',
    avatar_url: null,
    role: 'master_admin',
    site_id: null,
    is_active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'demo-admin-1',
    email: '815avenger@system.mil',
    username: '815avenger',
    full_name: 'Admin 1',
    avatar_url: null,
    role: 'admin',
    site_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'demo-admin-2',
    email: '817avenger@system.mil',
    username: '817avenger',
    full_name: 'Admin 2',
    avatar_url: null,
    role: 'admin',
    site_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'demo-admin-3',
    email: '821avenger@system.mil',
    username: '821avenger',
    full_name: 'Admin 3',
    avatar_url: null,
    role: 'admin',
    site_id: 'a0000000-0000-0000-0000-000000000003',
    is_active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'demo-admin-4',
    email: '586pechora@system.mil',
    username: '586pechora',
    full_name: 'Admin 4',
    avatar_url: null,
    role: 'admin',
    site_id: 'a0000000-0000-0000-0000-000000000004',
    is_active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  {
    id: 'demo-admin-5',
    email: 'hares@system.mil',
    username: 'HARES',
    full_name: 'Admin 5',
    avatar_url: null,
    role: 'admin',
    site_id: 'a0000000-0000-0000-0000-000000000005',
    is_active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
  // Alias for the same Admin 5 account — login username differs from display name.
  // The Supabase profiles table has username='smartguard' for this user, so the
  // DEMO_USERS fallback needs an entry matching that profile username to link to
  // the correct site_id. Same email + site_id as HARES above — they are the same person.
  {
    id: 'demo-admin-5',
    email: 'hares@system.mil',
    username: 'smartguard',
    full_name: 'Admin 5',
    avatar_url: null,
    role: 'admin',
    site_id: 'a0000000-0000-0000-0000-000000000005',
    is_active: true,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
  },
]

/**
 * Demo login — matches email to a demo user profile only.
 * Unknown emails return null (authentication fails).
 * In production mode, Supabase Auth handles this instead.
 */
export function demoLogin(email: string): Profile | null {
  const normalized = email.toLowerCase().trim()
  const user = DEMO_USERS.find((u) => u.email.toLowerCase() === normalized)
  if (user) return { ...user }
  // Unknown email — authentication fails
  return null
}

export function getDemoSites(): Site[] {
  return [...DEMO_SITES]
}

export function getDemoSiteById(siteId: string): Site | undefined {
  return DEMO_SITES.find((s) => s.id === siteId)
}
