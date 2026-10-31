import { CircleAlert, Loader2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { errorMessage } from '@/lib/api'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn('size-4 animate-spin text-muted', className)} />
}

export function FullPageSpinner() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center bg-canvas">
      <Spinner className="size-5" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}

/** Skeleton rows in place of a table while it loads. */
export function LoadingBlock({ className, rows = 3 }: { className?: string; rows?: number }) {
  return (
    <div role="status" className={cn('flex flex-col', className)}>
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="flex h-8 items-center gap-3 border-b border-line px-3 last:border-b-0">
          <div className="h-2.5 w-24 animate-pulse rounded-sm bg-skeleton motion-reduce:animate-none" />
          <div className="h-2.5 w-40 animate-pulse rounded-sm bg-skeleton motion-reduce:animate-none" />
          <div className="ms-auto h-2.5 w-14 animate-pulse rounded-sm bg-skeleton motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  )
}

export function ErrorBlock({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-3 px-4 py-6', className)}>
      <div className="flex items-start gap-2 text-body text-danger-text">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{errorMessage(error)}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-body text-danger-text">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{errorMessage(error)}</span>
    </p>
  )
}

/** Left-aligned, 60ch: what is missing in the user's terms, one sentence, one action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex max-w-[60ch] flex-col items-start gap-3 px-4 py-8">
      {Icon && <Icon aria-hidden className="size-4 text-muted" />}
      <div className="flex flex-col gap-1">
        <h2 className="text-[0.9375rem] leading-5 font-semibold">{title}</h2>
        {body && <p className="text-body text-muted">{body}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-h1 text-fg">{title}</h1>
        {description && <p className="max-w-[65ch] text-body text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
