import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-label-caps tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const variants = {
    primary: 'bg-primary-container hover:bg-primary-container/90 text-on-primary-container',
    secondary: 'border border-outline-variant text-on-surface-variant hover:bg-surface-variant',
    ghost: 'text-on-surface-variant hover:bg-surface-variant',
    danger: 'bg-error-container/20 text-error border border-error/30 hover:bg-error-container/30',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-[10px]',
    md: 'px-4 py-2.5',
    lg: 'px-6 py-3',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {children}
    </button>
  )
}
