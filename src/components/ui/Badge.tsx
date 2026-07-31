import { cn } from '@/utils/cn'

interface BadgeProps {
  children: React.ReactNode
  color?: string
  variant?: 'default' | 'outline' | 'dot'
  className?: string
}

export function Badge({ children, color = '#abc7ff', variant = 'default', className }: BadgeProps) {
  if (variant === 'dot') {
    return (
      <span className={cn('flex items-center gap-1.5', className)}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-label-caps" style={{ color }}>{children}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'px-2 py-0.5 text-label-caps border inline-flex items-center',
        variant === 'outline' ? 'bg-transparent' : '',
        className,
      )}
      style={{
        backgroundColor: variant === 'default' ? `${color}18` : 'transparent',
        color,
        borderColor: `${color}35`,
      }}
    >
      {children}
    </span>
  )
}
