import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}

/** Label, control, hint and error stacked with consistent spacing. Ids follow `${id}-hint|error`. */
export function Field({ id, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}

export function describedBy(id: string, error?: string, hint?: boolean) {
  if (error) return `${id}-error`
  return hint ? `${id}-hint` : undefined
}
