import { useEffect, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const sizeMap = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
  }

  return (
    <div className="modal-scrim fixed inset-0 z-[100] flex items-start justify-center pt-4 sm:items-center sm:pt-0 p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-surface-container border border-outline-variant w-full shadow-2xl max-h-[min(85vh,calc(100dvh-2rem))] flex flex-col overflow-hidden',
        'mx-0 sm:mx-4',
        sizeMap[size],
      )}>
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-outline-variant bg-surface-container-high shrink-0">
            <h2 className="text-headline-md text-on-surface truncate">{title}</h2>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface shrink-0 ml-2">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
