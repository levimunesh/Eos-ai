import { ChevronRight, Menu, Moon, Search, Sun } from 'lucide-react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/strings'
import { useTheme } from '@/lib/theme-context'
import { isApplePlatform } from '@/lib/use-hotkey'
import { crumbsFor } from './nav'
import { UserMenu } from './UserMenu'
import { BrandMark } from './Wordmark'

export function TopBar({ onOpenMenu, onOpenPalette }: { onOpenMenu: () => void; onOpenPalette: () => void }) {
  const { pathname } = useLocation()
  const crumbs = crumbsFor(pathname)
  const { resolved, toggle } = useTheme()
  const mod = isApplePlatform() ? '⌘' : 'Ctrl'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas/80 px-2 backdrop-blur-md sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('nav.openMenu')} onClick={onOpenMenu}>
        <Menu />
      </Button>
      <BrandMark className="size-6 lg:hidden" />

      <nav aria-label={t('shell.breadcrumbs')} className="ms-1 min-w-0 flex-1 lg:ms-0">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((key, i) => {
            const last = i === crumbs.length - 1
            return (
              <li key={key} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight aria-hidden className="hidden size-3.5 shrink-0 text-muted/70 sm:block rtl:-scale-x-100" />}
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'truncate font-medium text-fg' : 'hidden truncate text-muted sm:inline'}
                >
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
        className="focus-field hidden h-9 w-64 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-muted shadow-xs transition-colors hover:border-line-strong hover:text-fg-2 md:flex"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1 text-start">{t('shell.search')}</span>
        <kbd className="rounded border border-line bg-subtle px-1.5 font-sans text-2xs font-medium text-muted">
          {mod} K
        </kbd>
      </button>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('shell.search')} onClick={onOpenPalette}>
        <Search />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={resolved === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
        onClick={toggle}
      >
        {resolved === 'dark' ? <Sun /> : <Moon />}
      </Button>
      <UserMenu />
    </header>
  )
}
