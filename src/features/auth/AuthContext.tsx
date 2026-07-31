import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  getSession,
  signInWithEmail,
  signOut as authSignOut,
  onAuthStateChange,
  hasRole as checkRole,
  canManageSite as checkSiteAccess,
  canWrite as checkWrite,
  canManageSites as checkCanManageSites,
  canManageUsers as checkCanManageUsers,
  canManageSettings as checkCanManageSettings,
  getRoleDisplay,
} from '@/lib/supabase/auth'
import type { Profile, UserRole, Site } from '@/types'
import { isDemoMode, getDemoSites } from '@/utils/demoMode'
import { fetchSites, fetchSiteById, fetchProfile } from '@/lib/supabase/queries'

interface AuthState {
  user: Profile | null
  loading: boolean
  error: string | null
  userSite: Site | null
  sites: Site[]
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (...roles: UserRole[]) => boolean
  canManageSite: (siteId: string) => boolean
  canWrite: boolean
  canManageSites: boolean
  canManageUsers: boolean
  canManageSettings: boolean
  isMasterAdmin: boolean
  isAdmin: boolean
  isOperator: boolean
  isViewer: boolean
  roleDisplay: { label: string; color: string } | null
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [userSite, setUserSite] = useState<Site | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUserSite = useCallback(async (profile: Profile | null) => {
    if (!profile?.site_id) { setUserSite(null); return }
    try {
      if (isDemoMode()) {
        setUserSite(getDemoSites().find((s) => s.id === profile.site_id) ?? null)
      } else {
        setUserSite(await fetchSiteById(profile.site_id))
      }
    } catch { setUserSite(null) }
  }, [])

  const loadSites = useCallback(async () => {
    try { setSites(isDemoMode() ? getDemoSites() : await fetchSites()) }
    catch { setSites([]) }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user || isDemoMode()) return
    try {
      const profile = await fetchProfile(user.id)
      if (profile) { setUser(profile); await loadUserSite(profile) }
    } catch {}
  }, [user, loadUserSite])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        await loadSites()
        const { user: profile } = await getSession()
        if (mounted) { setUser(profile); await loadUserSite(profile) }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to initialize session')
      } finally { if (mounted) setLoading(false) }
    }
    init()

    const { subscription } = onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT' || !session) { setUser(null); setUserSite(null); setLoading(false); return }
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        try {
          const profile = await fetchProfile(session.user.id)
          if (mounted) { setUser(profile); await loadUserSite(profile) }
        } catch {}
      }
      if (mounted) setLoading(false)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [loadSites, loadUserSite])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null); setLoading(true)
    try {
      const { user: profile } = await signInWithEmail(email, password)
      setUser(profile); await loadUserSite(profile)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      setError(message); throw err
    } finally { setLoading(false) }
  }, [loadUserSite])

  const signOut = useCallback(async () => {
    await authSignOut(); setUser(null); setUserSite(null); setError(null)
  }, [])

  const hasRoleFn = useCallback((...roles: UserRole[]) => checkRole(user, ...roles), [user])

  const isMasterAdmin = checkRole(user, 'master_admin')
  const isAdmin = checkRole(user, 'admin')
  const isOperator = checkRole(user, 'site_operator')
  const isViewer = checkRole(user, 'viewer')
  const canWriteOp = checkWrite(user)
  const canManageSitesOp = checkCanManageSites(user)
  const canManageUsersOp = checkCanManageUsers(user)
  const canManageSettingsOp = checkCanManageSettings(user)
  const roleDisplay = user ? getRoleDisplay(user.role) : null

  return (
    <AuthContext.Provider
      value={{
        user, loading, error, userSite, sites,
        signIn, signOut,
        hasRole: hasRoleFn,
        canManageSite: (siteId: string) => checkSiteAccess(user, siteId),
        canWrite: canWriteOp,
        canManageSites: canManageSitesOp,
        canManageUsers: canManageUsersOp,
        canManageSettings: canManageSettingsOp,
        isMasterAdmin, isAdmin, isOperator, isViewer,
        roleDisplay, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
