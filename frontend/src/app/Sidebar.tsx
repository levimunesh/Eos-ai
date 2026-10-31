import { NavLink } from 'react-router'
import { useImportsQuery } from '@/features/imports/api'
import { OrgSwitcher } from '@/features/orgs/OrgSwitcher'
import { useOrg } from '@/features/orgs/org-context'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { navGroups, type NavItem } from './nav'
import { useShell } from './shell-context'
import { Wordmark } from './Wordmark'

const rowClass = 'sb-tip relative flex h-9 items-center gap-2.5 rounded-md px-2 text-body transition-colors lg:h-7'

function Item({ item, collapsed, badge }: { item: NavItem; collapsed: boolean; badge?: number }) {
  const Icon = item.icon
  const label = t(item.label)
  const { ask } = useShell()
  if (item.ask) {
    return (
      <li>
        <button
          type="button"
          onClick={() => ask()}
          data-tip={label}
          aria-label={collapsed ? label : undefined}
          className={cn(rowClass, 'w-full text-fg-2 hover:bg-surface-2 hover:text-fg', collapsed && 'justify-center px-0')}
        >
          <Icon aria-hidden className="size-[15px] shrink-0 text-dawn-ink" />
          <span className={cn('flex-1 truncate text-start', collapsed && 'sr-only')}>{label}</span>
          {!collapsed && <span aria-hidden className="bg-dawn size-1.5 rounded-full" />}
        </button>
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
          cn(rowClass, collapsed && 'justify-center px-0', isActive ? 'bg-surface-2 font-medium text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg')
        }
      >
        {({ isActive }) => (
          <>
            <Icon aria-hidden className={cn('size-[15px] shrink-0', isActive ? 'text-fg' : 'text-muted')} />
            <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{label}</span>
            {badge ? (
              <span
                aria-label={t('nav.importsRunning', { n: badge })}
                className={cn('mono rounded-sm bg-accent-soft px-1 text-[0.6875rem] leading-4 text-accent-text', collapsed && 'absolute -end-0.5 -top-0.5')}
              >
                {badge}
              </span>
            ) : null}
          </>
        )}
      </NavLink>
    </li>
  )
}

export function Sidebar({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { role } = useOrg()
  const imports = useImportsQuery(role !== 'viewer')
  const running = (imports.data ?? []).filter((i) => i.status === 'validating' || i.status === 'importing').length
  const groups = navGroups(role)

  return (
    <nav
      aria-label={t('nav.menu')}
      className={cn('flex h-full flex-col bg-canvas', collapsed && 'sb-collapsed')}
      onClick={(e) => {
        // Close the phone drawer after any navigation inside it.
        if ((e.target as HTMLElement).closest('a[href], [role="menuitemradio"]')) onNavigate?.()
      }}
    >
      <div className={cn('flex h-11 shrink-0 items-center px-4', collapsed && 'justify-center px-0')}>
        <Wordmark collapsed={collapsed} />
      </div>
      <div className={cn('px-2 pt-1 pb-2', collapsed && 'px-1.5')}>
        <OrgSwitcher compact={collapsed} />
      </div>
      <div className={cn('flex flex-1 flex-col gap-4 overflow-y-auto px-2 pt-2 pb-3', collapsed && 'px-1.5')}>
        {groups.map((g, gi) => {
          const isSettings = g.label === 'nav.settings'
          return (
            <div key={g.label} className={cn(isSettings && 'mt-auto')}>
              {collapsed ? (
                gi > 0 && <div aria-hidden className="mx-2 mb-2 border-t border-line" />
              ) : g.label === 'nav.groupAsk' ? null : (
                <p className="mb-1 px-2 text-caption text-muted">{t(g.label)}</p>
              )}
              <ul className="flex flex-col gap-px">
                {g.items.map((item) => (
                  <Item key={item.to} item={item} collapsed={collapsed} badge={item.to === '/imports' ? running : undefined} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
