import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'

/** Type-only wordmark: condensed EOS with a measured rule, no icon art. */
export function Wordmark({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-display text-[1.0625rem] font-semibold tracking-[0.04em]',
        tone === 'light' ? 'text-white' : 'text-petrol',
        className,
      )}
    >
      <span aria-hidden className={cn('h-4 w-1 rounded-[1px]', tone === 'light' ? 'bg-[#7fb8a0]' : 'bg-signal')} />
      {t('app.name')}
    </span>
  )
}
