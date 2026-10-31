import { ChevronRight, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/strings'
import { useTheme } from '@/lib/theme-context'
import { isApplePlatform } from '@/lib/use-hotkey'
import { cn } from '@/lib/utils'
import { crumbsFor } from './nav'
import { UserMenu } from './UserMenu'
import { AiMark, BrandMark } from './Wordmark'

export function TopBar({
  onOpenMenu,
  onOpenPalette,
  collapsed,
  onToggleCollapsed,
}: {
  onOpenMenu: () => void
  onOpenPalette: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const { pathname } = useLocation()
  const crumbs = crumbsFor(pathname)
  const { resolved, toggle } = useTheme()
  const mod = isApplePlatform() ? '⌘' : 'Ctrl'

  return (
    <header className="sticky top-0 z-30 flex h-11 items-center gap-1 border-b border-line bg-canvas/85 px-2 backdrop-blur-md sm:px-3 lg:px-4">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t('nav.openMenu')} onClick={onOpenMenu}>
        <Menu />
      </Button>
      <BrandMark className="ms-1 lg:hidden" />
      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t('shell.expand') : t('shell.collapse')}
          aria-expanded={!collapsed}
          aria-keyshortcuts="["
          title={`${collapsed ? t('shell.expand') : t('shell.collapse')} ([)`}
          className="hidden size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg lg:flex"
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="size-4 rtl:-scale-x-100" /> : <PanelLeftClose aria-hidden className="size-4 rtl:-scale-x-100" />}
        </button>
      )}

      {/* Breadcrumb only when the page sits inside a section; the page itself carries its title. */}
      <nav aria-label={t('shell.breadcrumbs')} className={cn('ms-1 min-w-0 flex-1', crumbs.length < 2 && 'invisible')}>
        <ol className="flex items-center gap-1 text-body">
          {crumbs.map((key, i) => {
            const last = i === crumbs.length - 1
            return (
              <li key={key} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden className="size-3 shrink-0 text-muted/70 rtl:-scale-x-100" />}
                <span aria-current={last ? 'page' : undefined} className={last ? 'truncate text-fg' : 'truncate text-muted'}>
                  {t(key)}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label={t('shell.search')}
        aria-keyshortcuts="Meta+K Control+K"
        className="focus-field hidden h-8 w-72 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-body text-muted transition-colors hover:border-line-strong hover:text-fg-2 md:flex"
      >
        <AiMark />
        <span className="flex-1 truncate text-start">{t('shell.search')}</span>
        <kbd className="mono rounded-sm border border-line px-1 text-[0.6875rem] leading-4 text-muted">{mod} K</kbd>
      </button>
      <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t('shell.search')} onClick={onOpenPalette}>
        <AiMark />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={resolved === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
        onClick={toggle}
      >
        {resolved === 'dark' ? <Sun /> : <Moon />}
      </Button>
      <UserMenu />
    </header>
  )
}
