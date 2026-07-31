import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomBar } from './BottomBar'

interface PageLayoutProps {
  title?: string
  children: ReactNode
  headerContent?: ReactNode
}

export function PageLayout({ title, children, headerContent }: PageLayoutProps) {
  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <TopBar title={title}>{headerContent}</TopBar>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-background md:pl-0">
          <div className="min-h-full">
            {children}
          </div>
        </main>
      </div>
      <BottomBar />
    </div>
  )
}
