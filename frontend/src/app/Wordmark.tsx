import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'

/** The dawn arc: a horizon with a sun rising over it. Drawn in the current colour. */
export function DawnArc({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 13.5h14" />
      <path d="M6 13.5a4 4 0 0 1 8 0" />
      <path d="M10 5v1.5M4.8 7.8l1 1M15.2 7.8l-1 1" strokeWidth="1.4" />
    </svg>
  )
}

/** Brand mark: ink tile, dawn-gradient glyph. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('relative inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-fg text-canvas', className)}>
      <DawnArc className="size-4" />
    </span>
  )
}

/** The AI's own icon: the arc at small scale in dawn colours. */
export function AiMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('bg-dawn inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] text-white', className)}>
      <DawnArc className="size-3" />
    </span>
  )
}

export function Wordmark({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[0.875rem] font-semibold tracking-tight text-fg', className)}>
      <BrandMark />
      <span className={cn(collapsed && 'sr-only')}>{t('app.name')}</span>
    </span>
  )
}
