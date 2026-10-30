import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('text-[0.8125rem] font-medium text-fg', className)} {...props} />
  ),
)
Label.displayName = 'Label'
