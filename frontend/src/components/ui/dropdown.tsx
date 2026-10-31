import * as Menu from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = Menu.Root
export const DropdownTrigger = Menu.Trigger
export const DropdownGroup = Menu.Group
export const DropdownRadioGroup = Menu.RadioGroup

export const DropdownContent = forwardRef<
  ElementRef<typeof Menu.Content>,
  ComponentPropsWithoutRef<typeof Menu.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <Menu.Portal>
    <Menu.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'anim-menu elev-raised z-50 min-w-52 overflow-hidden rounded-lg p-1 text-body text-fg',
        className,
      )}
      {...props}
    />
  </Menu.Portal>
))
DropdownContent.displayName = 'DropdownContent'

const itemClass =
  'relative flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-body outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 sm:min-h-7 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted'

export const DropdownItem = forwardRef<ElementRef<typeof Menu.Item>, ComponentPropsWithoutRef<typeof Menu.Item>>(
  ({ className, ...props }, ref) => <Menu.Item ref={ref} className={cn(itemClass, className)} {...props} />,
)
DropdownItem.displayName = 'DropdownItem'

export const DropdownRadioItem = forwardRef<
  ElementRef<typeof Menu.RadioItem>,
  ComponentPropsWithoutRef<typeof Menu.RadioItem>
>(({ className, children, ...props }, ref) => (
  <Menu.RadioItem ref={ref} className={cn(itemClass, 'ps-8', className)} {...props}>
    <span className="absolute start-2 flex size-4 items-center justify-center">
      <Menu.ItemIndicator>
        <span className="block size-1.5 rounded-full bg-accent" />
      </Menu.ItemIndicator>
    </span>
    {children}
  </Menu.RadioItem>
))
DropdownRadioItem.displayName = 'DropdownRadioItem'

export function DropdownLabel({ className, ...props }: ComponentPropsWithoutRef<typeof Menu.Label>) {
  return <Menu.Label className={cn('px-2 pt-1.5 pb-1 text-xs font-medium text-muted', className)} {...props} />
}

export function DropdownSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />
}
