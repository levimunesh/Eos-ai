import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'

/**
 * Right-docked panel (440px) on larger screens, bottom sheet on phones. Overlay surface, hairline
 * start edge, 32% dim with no blur. Sections inside are separated by spacing, not boxes.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  titleId,
  header,
  children,
  footer,
  className,
  modal = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Visible title text (also the dialog's accessible name). */
  title: ReactNode
  titleId?: string
  /** Extra header content under the title: status row, ids. */
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  modal?: boolean
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogPrimitive.Portal>
        {modal && <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay" />}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Land on the heading, not the close button, so nothing looks pre-selected.
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-sheet-focus]')?.focus()
          }}
          className={cn(
            'anim-sheet elev-floating fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-xl pb-[env(safe-area-inset-bottom)] focus:outline-none',
            'sm:inset-y-0 sm:start-auto sm:end-0 sm:max-h-none sm:w-[27.5rem] sm:rounded-none sm:border-s sm:border-line',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-8 shrink-0 rounded-full bg-line-strong sm:hidden" />
          <header className="flex items-start gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title {...(titleId ? { id: titleId } : {})} tabIndex={-1} data-sheet-focus className="text-[0.9375rem] leading-5 font-semibold tracking-tight focus:outline-none">
                {title}
              </DialogPrimitive.Title>
              {header}
            </div>
            <DialogPrimitive.Close
              aria-label={t('common.close')}
              className="-me-2 -mt-1 flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg sm:size-7"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          {footer}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
