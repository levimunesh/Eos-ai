import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'focus-field h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-[0.9375rem] text-fg shadow-xs placeholder:text-muted transition-[border-color,box-shadow] duration-150 hover:border-muted/50 disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted disabled:shadow-none aria-[invalid=true]:border-danger sm:h-9 sm:text-sm'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />
  ),
)
Input.displayName = 'Input'
