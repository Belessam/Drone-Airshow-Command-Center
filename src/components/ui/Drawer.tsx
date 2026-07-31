import { useEffect, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
  side?: 'right' | 'left'
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  width = 'w-[400px]',
  side = 'right',
}: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-[59]" onClick={onClose} />
      )}
      <div
        className={cn(
          'fixed top-0 h-full bg-surface-container/95 backdrop-blur-md border-l border-outline-variant z-[60] flex flex-col shadow-2xl transition-transform duration-300',
          'w-[400px] max-w-[90vw]',
          side === 'right' ? 'right-0' : 'left-0',
          isOpen ? 'translate-x-0' : (side === 'right' ? 'translate-x-full' : '-translate-x-full'),
        )}
      >
        {title && (
          <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-high shrink-0">
            <h2 className="text-headline-md text-on-surface truncate">{title}</h2>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface shrink-0 ml-2">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  )
}
