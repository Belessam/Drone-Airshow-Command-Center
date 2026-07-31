import { cn } from '@/utils/cn'

interface StatusDotProps {
  color?: string
  pulse?: boolean
  className?: string
}

export function StatusDot({ color = '#abc7ff', pulse = false, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        pulse && 'drone-pulse',
        className,
      )}
      style={{ backgroundColor: color }}
    />
  )
}
