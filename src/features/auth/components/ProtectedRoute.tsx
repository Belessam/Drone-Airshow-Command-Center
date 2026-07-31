import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: UserRole[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-label-caps text-outline">Authenticating...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && roles.length > 0) {
    const hasRequiredRole = roles.includes(user.role)
    if (!hasRequiredRole) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}

export function RoleGuard({
  children,
  roles,
  fallback = null,
}: {
  children: React.ReactNode
  roles: UserRole[]
  fallback?: React.ReactNode
}) {
  const { hasRole } = useAuth()
  if (!hasRole(...roles)) return <>{fallback}</>
  return <>{children}</>
}

export function AdminGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { isAdmin, isMasterAdmin } = useAuth()
  if (!isAdmin && !isMasterAdmin) return <>{fallback}</>
  return <>{children}</>
}

export function MasterAdminGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { isMasterAdmin } = useAuth()
  if (!isMasterAdmin) return <>{fallback}</>
  return <>{children}</>
}

export function WriteGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { canWrite } = useAuth()
  return canWrite ? <>{children}</> : <>{fallback}</>
}

export function SiteManageGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { canManageSites } = useAuth()
  return canManageSites ? <>{children}</> : <>{fallback}</>
}

export function UserManageGuard({
  children,
  fallback = null,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { canManageUsers } = useAuth()
  return canManageUsers ? <>{children}</> : <>{fallback}</>
}
