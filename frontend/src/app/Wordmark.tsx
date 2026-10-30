import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'

/** Dawn mark: a horizon line with a rising arc, on the brand gradient. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-dawn inline-flex size-7 shrink-0 items-center justify-center rounded-lg shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.2)]',
        className,
      )}
    >
      <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 13.5h14" />
        <path d="M6 13.5a4 4 0 0 1 8 0" />
      </svg>
    </span>
  )
}

export function Wordmark({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-[0.9375rem] font-semibold tracking-tight text-fg', className)}>
      <BrandMark />
      <span className={cn(collapsed && 'sr-only')}>{t('app.name')}</span>
    </span>
  )
}
