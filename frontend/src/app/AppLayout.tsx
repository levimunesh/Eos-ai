import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/strings'
import { Sidebar } from './Sidebar'
import { Wordmark } from './Wordmark'

export function AppLayout() {
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
          <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('nav.openMenu')}>
                <Menu />
              </Button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-40 bg-petrol-700/40" />
              <DialogPrimitive.Content
                className="anim-drawer fixed inset-y-0 start-0 z-50 w-[min(18rem,85vw)] focus:outline-none"
                aria-describedby={undefined}
              >
                <DialogPrimitive.Title className="sr-only">{t('nav.menu')}</DialogPrimitive.Title>
                <Sidebar onNavigate={() => setDrawer(false)} />
                <DialogPrimitive.Close
                  aria-label={t('common.close')}
                  className="absolute end-3 top-3 rounded-sm p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </DialogPrimitive.Close>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
          <Wordmark tone="dark" />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
