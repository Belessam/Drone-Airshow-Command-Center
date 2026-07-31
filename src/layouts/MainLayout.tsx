import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomBar } from './BottomBar'

export function MainLayout() {
  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — hidden on mobile, drawer via Sidebar component */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-hidden relative bg-surface-dim">
          <Outlet />
        </main>
      </div>
      <BottomBar />
    </div>
  )
}
