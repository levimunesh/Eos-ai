import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-sunken text-ink-2',
        petrol: 'bg-petrol-100 text-petrol',
        signal: 'bg-signal-50 text-signal',
        amber: 'bg-amber-50 text-amber',
        danger: 'bg-danger-50 text-danger',
        outline: 'border border-line-strong text-muted',
        onDark: 'bg-white/10 text-white/70',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
