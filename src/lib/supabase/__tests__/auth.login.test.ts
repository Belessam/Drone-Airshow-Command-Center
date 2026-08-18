/**
 * Login regression tests — production (non-demo) username → email resolution.
 *
 * Reproduces the reported bug: with VITE_DEMO_MODE=false the app rejected every
 * login with "Invalid username or access key." because resolveUsername() queried
 * the profiles table pre-auth with the anon key, and RLS (SELECT policies are
 * authenticated-only) silently returns zero rows.
 *
 * The supabase client is mocked to behave exactly like the real backend under
 * that RLS block; auth.ts itself is the REAL production code under test.
 *
 * Run with: npx vitest run src/lib/supabase/__tests__/auth.login.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { PROFILES_BY_EMAIL, dbLookup } = vi.hoisted(() => {
  const PROFILES_BY_EMAIL: Record<string, any> = {
    'masterofeyes@system.mil': {
      id: 'u-master', email: 'masterofeyes@system.mil', username: 'masterofeyes',
      full_name: 'Master Admin', role: 'master_admin', site_id: null,
    },
    '815avenger@system.mil': {
      id: 'u-admin-1', email: '815avenger@system.mil', username: '815avenger',
      full_name: 'Admin 1', role: 'admin', site_id: null,
    },
    '817avenger@system.mil': {
      id: 'u-admin-2', email: '817avenger@system.mil', username: '817avenger',
      full_name: 'Admin 2', role: 'admin', site_id: null,
    },
    '821avenger@system.mil': {
      id: 'u-admin-3', email: '821avenger@system.mil', username: '821avenger',
      full_name: 'Admin 3', role: 'admin', site_id: null,
    },
    '586pechora@system.mil': {
      id: 'u-admin-4', email: '586pechora@system.mil', username: '586pechora',
      full_name: 'Admin 4', role: 'admin', site_id: null,
    },
    'hares@system.mil': {
      id: 'u-admin-5', email: 'hares@system.mil', username: 'HARES',
      full_name: 'Admin 5', role: 'admin', site_id: null,
    },
  }
  const dbLookup = { enabled: false }
  return { PROFILES_BY_EMAIL, dbLookup }
})

const ACCESS_KEY = 'demo123'
const authCalls: Array<{ email: string; password: string }> = []

vi.mock('../client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`mock: unexpected table ${table}`)
      return {
        select: (cols: string) => {
          if (cols === 'email') {
            return {
              eq: (col: string, val: string) => ({
                eq: () => ({
                  maybeSingle: async () => {
                    // Simulates RLS: anon SELECT on profiles returns zero rows (no error).
                    if (!dbLookup.enabled) return { data: null, error: null }
                    const hit = Object.values(PROFILES_BY_EMAIL).find(
                      (p) => String(p[col]).toLowerCase() === String(val).toLowerCase(),
                    )
                    return hit
                      ? { data: { email: hit.email }, error: null }
                      : { data: null, error: null }
                  },
                }),
              }),
            }
          }
          return {
            eq: () => ({
              then: (cb: (r: { error: any }) => void) => {
                cb({ error: null })
                return Promise.resolve({ error: null })
              },
            }),
          }
        },
        update: () => ({
          eq: () => ({
            then: (cb: (r: { error: any }) => void) => {
              cb({ error: null })
              return Promise.resolve({ error: null })
            },
          }),
        }),
      }
    },
    auth: {
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        authCalls.push({ email, password })
        const profile = PROFILES_BY_EMAIL[email.toLowerCase()]
        if (!profile || password !== ACCESS_KEY) {
          return { data: { user: null }, error: new Error('Invalid login credentials') }
        }
        return {
          data: { user: { id: profile.id, email: profile.email }, session: { access_token: 'test-token' } },
          error: null,
        }
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

vi.mock('../queries', () => ({
  fetchProfile: async (userId: string) => {
    const profile = Object.values(PROFILES_BY_EMAIL).find((p) => p.id === userId)
    if (!profile) throw new Error('PGRST116: no rows')
    return {
      ...profile,
      avatar_url: null,
      is_active: true,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-26T00:00:00Z',
    }
  },
}))

import { signInWithEmail, getSession, signOut } from '../auth'
import { isDemoMode, DEMO_USERS, DEMO_SITES } from '@/utils/demoMode'

const SITE = {
  SITE_01: DEMO_SITES.find((s) => s.code === 'SITE-01')!.id,
  SITE_02: DEMO_SITES.find((s) => s.code === 'SITE-02')!.id,
  SITE_03: DEMO_SITES.find((s) => s.code === 'SITE-03')!.id,
  SITE_04: DEMO_SITES.find((s) => s.code === 'SITE-04')!.id,
  SITE_05: DEMO_SITES.find((s) => s.code === 'SITE-05')!.id,
}

describe('production login (VITE_DEMO_MODE=false)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    authCalls.length = 0
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    dbLookup.enabled = false
  })

  it('runs the production (non-demo) auth path', () => {
    expect(isDemoMode()).toBe(false)
  })

  it('logs in the Master Admin', async () => {
    const { user, session } = await signInWithEmail('masterofeyes', ACCESS_KEY)
    expect(user?.role).toBe('master_admin')
    expect(user?.site_id).toBeNull()
    expect(session).not.toBeNull()
    expect(authCalls[0].email).toBe('masterofeyes@system.mil')
  })

  it.each([
    ['Admin 1', '815avenger', 'SITE_01'],
    ['Admin 2', '817avenger', 'SITE_02'],
    ['Admin 3', '821avenger', 'SITE_03'],
    ['Admin 4', '586pechora', 'SITE_04'],
    ['Admin 5', 'HARES', 'SITE_05'],
  ])('logs in %s (%s) and maps to %s', async (_label, username, siteKey) => {
    const { user } = await signInWithEmail(username, ACCESS_KEY)
    expect(user?.role).toBe('admin')
    expect(user?.site_id).toBe(SITE[siteKey as keyof typeof SITE])
    const expectedEmail = username.toLowerCase() + '@system.mil'
    expect(authCalls[0].email).toBe(expectedEmail)
  })

  it('accepts the smartguard alias for Admin 5 (same account, SITE-05)', async () => {
    const { user } = await signInWithEmail('smartguard', ACCESS_KEY)
    expect(user?.site_id).toBe(SITE.SITE_05)
    expect(authCalls[0].email).toBe('hares@system.mil')
  })

  it('is case-insensitive for the HARES username', async () => {
    const { user } = await signInWithEmail('hares', ACCESS_KEY)
    expect(user?.site_id).toBe(SITE.SITE_05)
    expect(authCalls[0].email).toBe('hares@system.mil')
  })

  it('trims surrounding whitespace from the username', async () => {
    const { user } = await signInWithEmail('  815avenger  ', ACCESS_KEY)
    expect(user?.site_id).toBe(SITE.SITE_01)
    expect(authCalls[0].email).toBe('815avenger@system.mil')
  })

  it('rejects an unknown username with the reported error', async () => {
    await expect(signInWithEmail('intruder', ACCESS_KEY)).rejects.toThrow(
      'Invalid username or access key.',
    )
    expect(authCalls.length).toBe(0)
  })

  it('rejects a wrong access key even for a valid username', async () => {
    await expect(signInWithEmail('815avenger', 'wrong-key')).rejects.toThrow(
      'Invalid login credentials',
    )
  })

  it('prefers the profiles-table lookup when RLS permits it (DB first)', async () => {
    dbLookup.enabled = true
    const { user } = await signInWithEmail('817avenger', ACCESS_KEY)
    expect(user?.site_id).toBe(SITE.SITE_02)
    expect(authCalls[0].email).toBe('817avenger@system.mil')
    dbLookup.enabled = false
  })

  it('supports logout and re-login', async () => {
    const first = await signInWithEmail('815avenger', ACCESS_KEY)
    expect(first.user?.site_id).toBe(SITE.SITE_01)

    await signOut()

    const restored = await getSession()
    expect(restored.user).toBeNull()

    const second = await signInWithEmail('815avenger', ACCESS_KEY)
    expect(second.user?.site_id).toBe(SITE.SITE_01)
  })

  it('keeps demo-mode login working (regression)', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    expect(isDemoMode()).toBe(true)
    const { user } = await signInWithEmail('586pechora', 'any-key')
    expect(user?.site_id).toBe(SITE.SITE_04)
    await expect(signInWithEmail('ghost', 'any-key')).rejects.toThrow('Invalid credentials.')
  })

  it('DEMO_USERS mapping matches the required admin → site assignments', () => {
    const byUsername = (u: string) => DEMO_USERS.find((d) => d.username?.toLowerCase() === u.toLowerCase())
    expect(byUsername('815avenger')?.site_id).toBe(SITE.SITE_01)
    expect(byUsername('817avenger')?.site_id).toBe(SITE.SITE_02)
    expect(byUsername('821avenger')?.site_id).toBe(SITE.SITE_03)
    expect(byUsername('586pechora')?.site_id).toBe(SITE.SITE_04)
    expect(byUsername('HARES')?.site_id).toBe(SITE.SITE_05)
  })
})