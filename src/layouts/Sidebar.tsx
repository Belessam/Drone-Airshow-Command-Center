import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  onAddDrone?: () => void
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

const navItems = [
  { to: '/dashboard', icon: 'dashboard', label: 'Overview', exact: false },
  { to: '/dashboard', icon: 'map', label: 'Live Map', exact: true },
  { to: '/drones', icon: 'precision_manufacturing', label: 'Drones' },
  { to: '/sites', icon: 'location_on', label: 'Sites' },
  { to: '/alerts', icon: 'warning', label: 'Alerts' },
  { to: '/history', icon: 'history', label: 'History' },
  { to: '/security/sessions', icon: 'devices', label: 'Active Sessions', masterAdminOnly: true },
  { to: '/settings', icon: 'settings', label: 'Settings' },
]

export function Sidebar({ onAddDrone, isMobileOpen, onMobileClose }: SidebarProps) {
  const { user, userSite, signOut, roleDisplay, canWrite, isMasterAdmin } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isOpen = isMobileOpen !== undefined ? isMobileOpen : mobileOpen
  const close = onMobileClose || (() => setMobileOpen(false))

  // Close sidebar on route change (mobile)
  const handleNavClick = () => {
    if (isOpen) close()
  }

  const sidebarContent = (
    <aside className="flex flex-col h-full w-[280px] py-4 bg-surface-container border-r border-outline-variant z-30 shrink-0">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 flex items-center justify-center rounded-lg border border-primary/30">
            <span className="material-symbols-outlined icon-filled text-primary">
              precision_manufacturing
            </span>
          </div>
          <div>
            <p className="text-label-caps tracking-widest text-outline">Mission Control</p>
            <p className="text-[10px] text-on-surface-variant/60 font-data-mono">v4.2.0-Alpha</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.filter(item => !item.masterAdminOnly || isMasterAdmin).map((item) => (
          <NavLink
            key={item.to + '-' + item.label}
            to={item.to}
            end={item.exact}
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 min-h-[44px] transition-all duration-150 ease-in-out ${
                isActive
                  ? 'text-primary border-r-2 border-primary bg-primary/10'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-label-caps font-label-caps">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-6 mt-auto space-y-3">
        {/* User profile card */}
        <NavLink
          to="/profile"
          onClick={handleNavClick}
          className="flex items-center gap-3 px-2 py-2 min-h-[44px] border-t border-outline-variant pt-4 hover:bg-surface-container-high transition-colors group"
        >
          <div className="w-10 h-10 rounded bg-surface-container-highest border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
            <img src="/avatar.svg" alt="User" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-label-caps text-on-surface truncate group-hover:text-primary transition-colors">
              {user?.full_name || 'User'}
            </p>
            {roleDisplay && (
              <p className="text-[10px] font-data-mono uppercase truncate" style={{ color: roleDisplay.color }}>
                {roleDisplay.label}
              </p>
            )}
            {userSite && (
              <p className="text-[9px] text-outline font-data-mono truncate">
                {userSite.code} — {userSite.name}
              </p>
            )}
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); signOut() }}
            className="text-on-surface-variant hover:text-on-surface opacity-0 group-hover:opacity-100 transition-opacity"
            title="Sign out"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </NavLink>

        {/* Register Drone button — any role with write permission */}
        {canWrite && onAddDrone && (
          <button
            onClick={() => { onAddDrone(); handleNavClick() }}
            className="w-full bg-primary text-on-primary py-3 min-h-[44px] rounded-lg font-label-caps tracking-wide hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Register Drone
          </button>
        )}
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex">{sidebarContent}</div>

      {/* Mobile hamburger button — visible below md, only when this Sidebar
          manages its own open state (not when rendered inside the TopBar drawer) */}
      {isMobileOpen === undefined && (
        <button
          className="md:hidden fixed top-3 left-3 z-[70] w-10 h-10 bg-surface-container border border-outline-variant rounded-lg flex items-center justify-center shadow-lg"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <span className="material-symbols-outlined text-on-surface">menu</span>
        </button>
      )}

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <div className="absolute left-0 top-0 h-full shadow-2xl animate-slide-in">{sidebarContent}</div>
        </div>
      )}
    </>
  )
}
