import { type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: string
  hint?: string
}

export function Input({ label, icon, hint, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-label-caps text-on-surface-variant flex justify-between">
          <span>{label}</span>
          {props.required && <span className="text-primary/50">Required</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-outline text-sm">{icon}</span>
          </div>
        )}
        <input
          className={cn(
            'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-body-base py-2.5 transition-all duration-200 outline-none focus:border-primary focus:shadow-[0_0_0_1px_#2F80ED]',
            icon ? 'pl-10' : 'px-3',
            'pr-3',
            className,
          )}
          {...props}
        />
      </div>
      {hint && <p className="text-body-sm text-outline">{hint}</p>}
    </div>
  )
}
