import { useAuth } from '@/hooks/useAuth'
import { PageLayout } from '@/layouts/PageLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function ProfilePage() {
  const { user, userSite, roleDisplay, signOut, isAdmin } = useAuth()

  return (
    <PageLayout title="User Profile">
      <div className="p-6 max-w-2xl">
        {/* Profile Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-16 h-16 rounded-full bg-surface-container-highest border-2 border-outline-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
            </div>
            <div className="flex-1">
              <h2 className="text-headline-md text-on-surface">{user?.full_name || 'Unknown Operator'}</h2>
              {roleDisplay && (
                <p className="text-label-caps uppercase mt-1" style={{ color: roleDisplay.color }}>
                  {roleDisplay.label}
                </p>
              )}
              <p className="text-[10px] text-on-surface-variant font-data-mono mt-0.5">
                {user?.created_at ? `Member since ${new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
              </p>
            </div>
            <div className="ml-auto">
              <Button variant="secondary" icon="edit">Edit Profile</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface p-4 border border-outline-variant">
              <span className="text-label-caps text-outline block mb-1">Email</span>
              <span className="text-body-base text-on-surface">{user?.email || 'Not available'}</span>
            </div>
            <div className="bg-surface p-4 border border-outline-variant">
              <span className="text-label-caps text-outline block mb-1">Role</span>
              <div className="flex items-center gap-2">
                {roleDisplay && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: roleDisplay.color }} />}
                <span className="text-body-base text-on-surface capitalize">{user?.role?.replace('_', ' ') || 'N/A'}</span>
              </div>
            </div>
            <div className="bg-surface p-4 border border-outline-variant">
              <span className="text-label-caps text-outline block mb-1">Site Assignment</span>
              {userSite ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: userSite.color }} />
                  <span className="text-body-base text-on-surface">{userSite.code} — {userSite.name}</span>
                </div>
              ) : (
                <span className="text-body-base text-on-surface-variant">Not assigned</span>
              )}
            </div>
            <div className="bg-surface p-4 border border-outline-variant">
              <span className="text-label-caps text-outline block mb-1">Account Status</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#27AE60]" />
                <span className="text-body-base text-on-surface">Active</span>
              </div>
            </div>
          </div>

          {/* User ID for support */}
          <div className="mt-4 p-2 bg-surface-container-low border border-outline-variant">
            <span className="text-[9px] text-outline font-data-mono">User ID: {user?.id || 'N/A'}</span>
          </div>
        </Card>

        {/* Security Info */}
        <Card className="p-6">
          <h3 className="text-label-caps text-outline mb-4">SECURITY & ACCESS</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface border border-outline-variant">
              <div>
                <p className="text-body-sm text-on-surface font-medium">Two-Factor Authentication</p>
                <p className="text-body-sm text-on-surface-variant">Add an extra layer of security to your account.</p>
              </div>
              <Button variant="secondary" size="sm">Enable</Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface border border-outline-variant">
              <div>
                <p className="text-body-sm text-on-surface font-medium">Session Management</p>
                <p className="text-body-sm text-on-surface-variant">View and manage your active sessions.</p>
              </div>
              <Button variant="secondary" size="sm">View</Button>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface border border-outline-variant">
              <div>
                <p className="text-body-sm text-on-surface font-medium">API Access Tokens</p>
                <p className="text-body-sm text-on-surface-variant">Manage tokens for programmatic access.</p>
              </div>
              <Button variant="secondary" size="sm">Manage</Button>
            </div>
          </div>
        </Card>

        {/* Sign Out */}
        <div className="mt-6">
          <Button variant="danger" icon="logout" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </PageLayout>
  )
}
