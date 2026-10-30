import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/** Bottom sheet on phones, centred panel from the `sm` breakpoint. */
export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'anim-dialog fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-elevated pb-[env(safe-area-inset-bottom)] shadow-lg focus:outline-none',
        'sm:inset-x-4 sm:top-[10vh] sm:bottom-auto sm:mx-auto sm:max-h-[80vh] sm:max-w-lg sm:rounded-xl sm:pb-0',
        className,
      )}
      {...props}
    >
      <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute end-2 top-3 flex size-11 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg sm:end-3 sm:size-8"
          aria-label={t('common.close')}
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 px-5 pt-4 pe-14 pb-3 sm:pt-5', className)} {...props} />
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-2', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 px-5 pt-3 pb-5 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-semibold tracking-tight text-fg', className)} {...props} />
))
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted', className)} {...props} />
))
DialogDescription.displayName = 'DialogDescription'
