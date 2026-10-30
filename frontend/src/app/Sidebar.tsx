import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router'
import { OrgSwitcher } from '@/features/orgs/OrgSwitcher'
import { useOrg } from '@/features/orgs/org-context'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { visiblePrimary, visibleSettings, type NavItem } from './nav'
import { Wordmark } from './Wordmark'

function Item({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  const label = t(item.label)
  if (item.disabled) {
    return (
      <li>
        <span
          aria-disabled="true"
          data-tip={`${label}: ${t('common.comingLater')}`}
          tabIndex={collapsed ? 0 : undefined}
          className={cn(
            'sb-tip flex min-h-11 cursor-not-allowed items-center gap-3 rounded-md px-2.5 text-sm text-muted/80 lg:min-h-9',
            collapsed && 'justify-center px-0',
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0 opacity-70" />
          <span className={cn('flex min-w-0 flex-1 items-center justify-between gap-2', collapsed && 'sr-only')}>
            <span className="truncate">{label}</span>
            <span className="rounded-full px-1.5 text-2xs text-muted ring-1 ring-line-strong ring-inset">
              {t('common.soon')}
            </span>
          </span>
        </span>
      </li>
    )
  }
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        data-tip={label}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'sb-tip relative flex min-h-11 items-center gap-3 rounded-md px-2.5 text-sm transition-colors lg:min-h-9',
            collapsed && 'justify-center px-0',
            isActive
              ? 'bg-surface font-medium text-fg shadow-sm ring-1 ring-line before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-[image:var(--dawn)]'
              : 'text-fg-2 hover:bg-subtle hover:text-fg',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon aria-hidden className={cn('size-4 shrink-0', isActive ? 'text-accent-text' : 'text-muted')} />
            <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}

export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed?: boolean
  onToggleCollapsed?: () => void
  onNavigate?: () => void
}) {
  const { role } = useOrg()
  return (
    <nav
      aria-label={t('nav.menu')}
      className={cn('flex h-full flex-col border-e border-line bg-canvas', collapsed && 'sb-collapsed')}
      onClick={(e) => {
        // Close the phone drawer after any navigation inside it.
        if ((e.target as HTMLElement).closest('a[href], [role="menuitemradio"]')) onNavigate?.()
      }}
    >
      <div className={cn('flex h-14 shrink-0 items-center px-4', collapsed && 'justify-center px-0')}>
        <Wordmark collapsed={collapsed} />
      </div>
      <div className={cn('px-3 pb-3', collapsed && 'px-2')}>
        <OrgSwitcher compact={collapsed} />
      </div>
      <div className={cn('flex-1 overflow-y-auto px-3 pb-3', collapsed && 'px-2')}>
        <ul className="flex flex-col gap-0.5">
          {visiblePrimary(role).map((item) => (
            <Item key={item.to} item={item} collapsed={collapsed} />
          ))}
        </ul>
        <p className={cn('mt-6 mb-1.5 px-2.5 text-xs font-medium text-muted', collapsed && 'sr-only')}>
          {t('nav.settings')}
        </p>
        {collapsed && <div aria-hidden className="mx-2 my-4 border-t border-line" />}
        <ul className="flex flex-col gap-0.5">
          {visibleSettings(role).map((item) => (
            <Item key={item.to} item={item} collapsed={collapsed} />
          ))}
        </ul>
      </div>
      {onToggleCollapsed && (
        <div className={cn('border-t border-line p-3', collapsed && 'px-2')}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t('shell.expand') : t('shell.collapse')}
            aria-expanded={!collapsed}
            data-tip={t('shell.expand')}
            className={cn(
              'sb-tip flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm text-muted hover:bg-subtle hover:text-fg',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden className="size-4 rtl:-scale-x-100" />
            ) : (
              <PanelLeftClose aria-hidden className="size-4 rtl:-scale-x-100" />
            )}
            <span className={cn(collapsed && 'sr-only')}>{t('shell.collapse')}</span>
          </button>
        </div>
      )}
    </nav>
  )
}
