import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown'
import { cn } from '@/lib/utils'

export interface RowAction {
  label: string
  icon: LucideIcon
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/** Phone-only overflow menu for a table row; inline buttons take over from `sm` up. */
export function RowActionsMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownTrigger
        aria-label={label}
        className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg sm:hidden"
      >
        <MoreHorizontal className="size-4" />
      </DropdownTrigger>
      <DropdownContent align="end" className="min-w-48">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <DropdownItem
              key={a.label}
              disabled={a.disabled}
              onSelect={a.onSelect}
              className={cn(a.danger && 'text-danger-text [&_svg]:!text-danger-text')}
            >
              <Icon aria-hidden />
              {a.label}
            </DropdownItem>
          )
        })}
      </DropdownContent>
    </DropdownMenu>
  )
}
