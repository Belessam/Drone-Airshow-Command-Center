import { type SelectHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-label-caps text-on-surface-variant">{label}</label>
      )}
      <select
        className={cn(
          'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-body-base py-2.5 px-3 outline-none focus:border-primary focus:shadow-[0_0_0_1px_#2F80ED] transition-all',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
