import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AnswerPanel } from '@/features/assistant/AnswerPanel'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { CommandPalette } from './CommandPalette'
import { ShellContext, type ShellActions } from './shell-context'
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

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null
  return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable)
}

export function AppLayout() {
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const [prefill, setPrefill] = useState('')
  const [panel, setPanel] = useState(false)
  const [question, setQuestion] = useState<{ text: string; key: number } | null>(null)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const { pathname } = useLocation()

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // ignore
      }
      return !c
    })
  }, [])

  // `[` collapses and expands the sidebar, as in Linear.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleCollapsed])

  const shell = useMemo<ShellActions>(
    () => ({
      openPalette: (text) => {
        setPrefill(text ?? '')
        setPalette(true)
      },
      ask: (text) => {
        if (text?.trim()) setQuestion({ text: text.trim(), key: Date.now() })
        setPanel(true)
      },
    }),
    [],
  )

  return (
    <ShellContext.Provider value={shell}>
      <div
        className={cn(
          'min-h-dvh bg-canvas lg:grid lg:transition-[grid-template-columns] lg:duration-200',
          collapsed ? 'lg:grid-cols-[3.5rem_1fr]' : 'lg:grid-cols-[14rem_1fr]',
        )}
      >
        <aside className="sticky top-0 hidden h-dvh border-e border-line lg:block">
          <Sidebar collapsed={collapsed} />
        </aside>

        <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-40 bg-overlay lg:hidden" />
            <DialogPrimitive.Content
              className="anim-drawer elev-floating fixed inset-y-0 start-0 z-50 w-[min(16rem,86vw)] focus:outline-none lg:hidden"
              aria-describedby={undefined}
            >
              <DialogPrimitive.Title className="sr-only">{t('nav.menu')}</DialogPrimitive.Title>
              <Sidebar onNavigate={() => setDrawer(false)} />
              <DialogPrimitive.Close
                aria-label={t('common.close')}
                className="absolute end-2 top-1 flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <div className="flex min-w-0 flex-col">
          <TopBar
            onOpenMenu={() => setDrawer(true)}
            onOpenPalette={() => shell.openPalette()}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
          <main key={pathname} className="anim-page mx-auto w-full max-w-[1280px] flex-1 px-4 py-5 sm:px-6 lg:py-6">
            <Outlet />
          </main>
        </div>

        <CommandPalette open={palette} onOpenChange={setPalette} initialQuery={prefill} onAsk={(q) => shell.ask(q)} />
        <AnswerPanel open={panel} onOpenChange={setPanel} question={question?.text} questionKey={question?.key} />
      </div>
    </ShellContext.Provider>
  )
}
