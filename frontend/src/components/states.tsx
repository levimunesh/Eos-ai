import { CircleAlert, Loader2 } from 'lucide-react'
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
    <div role="status" className="flex min-h-dvh items-center justify-center bg-paper">
      <Spinner className="size-5" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div role="status" className={cn('flex items-center gap-2 px-5 py-10 text-sm text-muted', className)}>
      <Spinner />
      {t('common.loading')}
    </div>
  )
}

export function ErrorBlock({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-3 px-5 py-8', className)}>
      <div className="flex items-start gap-2 text-sm text-danger">
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
    <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{errorMessage(error)}</span>
    </p>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="max-w-[65ch] text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
