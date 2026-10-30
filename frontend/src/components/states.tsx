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
        <div key={i} aria-hidden className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
          <div className="size-8 animate-pulse rounded-full bg-skeleton" />
          <div className="h-3 w-40 animate-pulse rounded bg-skeleton" />
          <div className="ms-auto h-3 w-16 animate-pulse rounded bg-skeleton" />
        </div>
      ))}
    </div>
  )
}

export function ErrorBlock({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-3 px-5 py-8', className)}>
      <div className="flex items-start gap-2 text-sm text-danger-text">
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
    <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-text">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{errorMessage(error)}</span>
    </p>
  )
}

/** Icon, one sentence of direction, and at most one action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-subtle text-muted shadow-xs">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
        {body && <p className="text-sm text-muted">{body}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-[1.375rem] leading-tight font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description && <p className="max-w-[65ch] text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
