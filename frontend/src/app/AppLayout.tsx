import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const COLLAPSE_KEY = 'eos.sidebarCollapsed'

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppLayout() {
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const { pathname } = useLocation()

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // ignore
      }
      return !c
    })
  }

  return (
    <div
      className={cn(
        'min-h-dvh bg-canvas lg:grid lg:transition-[grid-template-columns] lg:duration-200',
        collapsed ? 'lg:grid-cols-[4rem_1fr]' : 'lg:grid-cols-[15.5rem_1fr]',
      )}
    >
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] lg:hidden" />
          <DialogPrimitive.Content
            className="anim-drawer fixed inset-y-0 start-0 z-50 w-[min(18rem,86vw)] shadow-lg focus:outline-none lg:hidden"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">{t('nav.menu')}</DialogPrimitive.Title>
            <Sidebar onNavigate={() => setDrawer(false)} />
            <DialogPrimitive.Close
              aria-label={t('common.close')}
              className="absolute end-2 top-1.5 flex size-11 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-col">
        <TopBar onOpenMenu={() => setDrawer(true)} onOpenPalette={() => setPalette(true)} />
        <main key={pathname} className="anim-page mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  )
}
