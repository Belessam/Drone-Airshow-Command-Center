import { cn } from '@/utils/cn'
import type { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
  style?: CSSProperties
}

export function Card({ children, className, onClick, hover, style }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-container border border-outline-variant',
        hover && 'hover:bg-surface-container-high transition-colors cursor-pointer',
        className,
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('p-3 border-b border-outline-variant bg-surface-container-high', className)}>
      {children}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-3', className)}>{children}</div>
}
