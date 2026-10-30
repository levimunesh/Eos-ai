import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background,color,box-shadow,border-color] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'btn-dawn text-accent-fg',
        secondary:
          'border border-line-strong bg-surface text-fg shadow-xs hover:border-muted/40 hover:bg-subtle',
        ghost: 'text-fg-2 hover:bg-subtle hover:text-fg',
        danger: 'bg-danger text-white shadow-xs hover:brightness-95',
        'danger-ghost': 'text-danger-text hover:bg-danger-soft',
        link: 'h-auto px-0 text-accent-text underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm sm:h-8',
        md: 'h-11 px-4 text-sm sm:h-9',
        lg: 'h-11 px-5 text-sm',
        icon: 'size-11 sm:size-9',
        'icon-sm': 'size-11 sm:size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
