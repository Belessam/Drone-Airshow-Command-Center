import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { Sidebar } from './Sidebar'

interface TopBarProps {
  title?: string
  children?: React.ReactNode
  /** Forwards "Register Drone" to the mobile sidebar drawer (same as desktop sidebar). */
  onAddDrone?: () => void
}

export function TopBar({ title, children, onAddDrone }: TopBarProps) {
  const { user, roleDisplay, userSite } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [time, setTime] = useState(new Date())
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {/* Mobile sidebar drawer */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full shadow-2xl">
            <Sidebar isMobileOpen={true} onMobileClose={() => setMobileSidebarOpen(false)} onAddDrone={onAddDrone} />
          </div>
        </div>
      )}

      <header className="flex justify-between items-center w-full px-3 md:px-grid-gutter h-14 bg-surface border-b border-outline-variant z-40 shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center shrink-0 -ml-1"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-on-surface">menu</span>
          </button>

          <h1 className="text-headline-md font-headline-md font-bold text-on-surface tracking-tight truncate">
            {title || 'Drone Airshow Command Center'}
          </h1>
          <div className="hidden sm:block h-6 w-px bg-outline-variant" />
          <div className="hidden sm:flex gap-4 items-center">
            <span className="text-error font-bold text-data-mono flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-error inline-block animate-pulse" />
              LIVE
            </span>
            <span className="text-on-surface-variant text-data-mono">
              {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })} UTC
            </span>
          </div>
          {children}
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button
            onClick={toggleTheme}
            className="material-symbols-outlined text-primary hover:bg-surface-variant transition-colors p-2 rounded cursor-pointer active:scale-95 w-10 h-10 flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </button>
          <button className="hidden sm:flex material-symbols-outlined text-primary hover:bg-surface-variant transition-colors p-2 rounded cursor-pointer active:scale-95 relative w-10 h-10 items-center justify-center">
            notifications
            <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
          </button>
          <div className="hidden sm:flex items-center gap-2 border-l border-outline-variant pl-4">
            <div className="text-right">
              <div className="text-label-caps text-on-surface truncate max-w-[120px]">{user?.full_name || 'User'}</div>
              <div className="flex items-center gap-2 justify-end">
                {roleDisplay && (
                  <span className="text-[10px] font-data-mono uppercase" style={{ color: roleDisplay.color }}>
                    {roleDisplay.label}
                  </span>
                )}
                {userSite && (
                  <>
                    <span className="text-[9px] text-outline">|</span>
                    <span className="text-[9px] text-outline font-data-mono">{userSite.code}</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded bg-surface-container-highest border border-outline-variant overflow-hidden flex items-center justify-center shrink-0">
              <img src="/avatar.svg" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
