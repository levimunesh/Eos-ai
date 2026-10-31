import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * State labels. The default is a dot plus plain text (no fill); `filled` keeps a soft fill for
 * the rare case where the label must stand apart from surrounding text (e.g. a demo marker).
 */
const badgeVariants = cva('inline-flex items-center gap-1.5 text-caption font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'text-fg-2 [--dot:var(--muted)]',
      accent: 'text-accent-text [--dot:var(--accent)]',
      success: 'text-success [--dot:var(--success)]',
      warning: 'text-warning [--dot:var(--warning)]',
      danger: 'text-danger-text [--dot:var(--danger)]',
      outline: 'text-muted [--dot:var(--line-strong)]',
    },
    filled: {
      true: 'rounded-md px-1.5 py-px ring-1 ring-line ring-inset',
      false: '',
    },
  },
  defaultVariants: { tone: 'neutral', filled: false },
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, tone, filled, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, filled }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--dot)]" />}
      {children}
    </span>
  )
}
