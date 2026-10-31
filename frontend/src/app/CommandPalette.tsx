import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Building2, CornerDownLeft, FileUp, Moon, Plus, Store, Sun, UserPlus, type LucideIcon } from 'lucide-react'
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '@/components/ui/avatar'
import { useOrg } from '@/features/orgs/org-context'
import { t } from '@/lib/strings'
import { useTheme } from '@/lib/theme-context'
import { useModHotkey } from '@/lib/use-hotkey'
import { cn } from '@/lib/utils'
import { visiblePrimary, visibleSettings } from './nav'
import { routeQuery } from './route-query'
import { AiMark } from './Wordmark'

export interface Command {
  id: string
  group: string
  label: string
  icon?: LucideIcon
  /** Rendered instead of the icon: the AI mark on the Ask row. */
  mark?: ReactNode
  /** The ask row: free text that matches no command becomes a question for EOS. */
  ask?: boolean
  avatar?: { name: string; seed: string }
  keywords?: string
  run: () => void
}

function useCommands(close: () => void, onAsk: (q: string) => void): Command[] {
  const navigate = useNavigate()
  const { me, orgId, role, isOwner, switchOrg } = useOrg()
  const { resolved, toggle } = useTheme()

  return useMemo(() => {
    const go = (to: string) => () => {
      close()
      navigate(to)
    }
    const askRow: Command = {
      id: 'ask',
      group: t('palette.groupAsk'),
      label: t('nav.ask'),
      mark: <AiMark />,
      ask: true,
      keywords: 'ask question ai assistant eos',
      run: () => {
        close()
        onAsk('')
      },
    }
    const nav: Command[] = [...visiblePrimary(role), ...visibleSettings(role)].map((n) => ({
      id: `nav:${n.to}`,
      group: t('palette.groupNavigate'),
      label: t(n.label),
      icon: n.icon,
      keywords: n.to,
      run: go(n.to),
    }))
    const actions: Command[] = []
    if (role !== 'viewer') {
      actions.push({ id: 'act:import', group: t('palette.groupActions'), label: t('palette.newImport'), icon: FileUp, keywords: 'upload csv excel data import', run: go('/imports/new') })
    }
    if (isOwner) {
      actions.push(
        { id: 'act:invite', group: t('palette.groupActions'), label: t('palette.inviteMember'), icon: UserPlus, keywords: 'member team', run: go('/settings/members?invite=1') },
        { id: 'act:branch', group: t('palette.groupActions'), label: t('palette.addBranch'), icon: Store, keywords: 'location store', run: go('/settings/branches?new=1') },
      )
    }
    actions.push(
      {
        id: 'act:theme',
        group: t('palette.groupActions'),
        label: t('palette.toggleTheme'),
        icon: resolved === 'dark' ? Sun : Moon,
        keywords: 'dark light mode appearance',
        run: () => {
          close()
          toggle()
        },
      },
      { id: 'act:neworg', group: t('palette.groupActions'), label: t('palette.newOrg'), icon: Plus, keywords: 'organisation company', run: go('/onboarding') },
    )
    const orgs: Command[] = me.memberships
      .filter((m) => m.org_id !== orgId)
      .map((m) => ({
        id: `org:${m.org_id}`,
        group: t('palette.groupOrgs'),
        label: m.org_name,
        avatar: { name: m.org_name, seed: m.org_id },
        keywords: 'switch organisation',
        run: () => {
          close()
          switchOrg(m.org_id)
          navigate('/')
        },
      }))
    return [askRow, ...nav, ...actions, ...orgs]
  }, [close, onAsk, navigate, me.memberships, orgId, role, isOwner, switchOrg, resolved, toggle])
}

function PaletteBody({ onClose, onAsk, initialQuery = '' }: { onClose: () => void; onAsk: (q: string) => void; initialQuery?: string }) {
  const commands = useCommands(onClose, onAsk)
  const [query, setQuery] = useState(initialQuery)
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => routeQuery(query, commands), [commands, query])
  const run = (c: Command) => {
    if (c.ask) {
      onClose()
      onAsk(query.trim())
    } else c.run()
  }

  const select = (i: number) => {
    setActive(i)
    listRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      select(Math.min(filtered.length - 1, active + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      select(Math.max(0, active - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) run(filtered[active])
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <AiMark />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-label={t('palette.placeholder')}
          aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKey}
          className="h-12 w-full bg-transparent text-[0.9375rem] text-fg outline-none placeholder:text-muted"
        />
        <kbd className="mono hidden rounded-sm border border-line px-1 text-[0.6875rem] text-muted sm:block">esc</kbd>
      </div>
      <div ref={listRef} id={listId} role="listbox" aria-label={t('palette.title')} className="max-h-[min(60dvh,24rem)] overflow-y-auto p-1.5">

        {filtered.map((c, i) => {
          const header = i === 0 || filtered[i - 1].group !== c.group ? c.group : null
          const Icon = c.icon
          return (
            <div key={c.id}>
              {header && <p className="px-2.5 pt-2 pb-1 text-caption text-muted">{header}</p>}
              <div
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(c)}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-body sm:min-h-8',
                  i === active ? 'bg-surface-2 text-fg' : 'text-fg-2',
                )}
              >
                {c.mark ? (
                  c.mark
                ) : c.avatar ? (
                  <Avatar name={c.avatar.name} seed={c.avatar.seed} className="size-5 rounded text-[0.5625rem]" />
                ) : Icon ? (
                  <Icon aria-hidden className={cn('size-4', i === active ? 'text-fg' : 'text-muted')} />
                ) : (
                  <Building2 aria-hidden className="size-4 text-muted" />
                )}
                <span className="flex-1 truncate">{c.label}</span>
                {i === active && <CornerDownLeft aria-hidden className="size-3.5 text-muted rtl:-scale-x-100" />}
              </div>
            </div>
          )
        })}
      </div>
      <p className="hidden border-t border-line px-4 py-2 text-caption text-muted sm:block">{t('palette.hint')}</p>
    </>
  )
}

export function CommandPalette({
  open,
  onOpenChange,
  onAsk,
  initialQuery,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onAsk?: (question: string) => void
  initialQuery?: string
}) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const ask = useCallback((q: string) => onAsk?.(q), [onAsk])
  const toggle = useCallback(() => onOpenChange(!open), [onOpenChange, open])
  useModHotkey('k', toggle)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="anim-dialog elev-floating fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-xl pb-[env(safe-area-inset-bottom)] focus:outline-none sm:inset-x-4 sm:top-[14vh] sm:bottom-auto sm:mx-auto sm:max-w-xl sm:rounded-xl sm:pb-0"
        >
          <DialogPrimitive.Title className="sr-only">{t('palette.title')}</DialogPrimitive.Title>
          {open && <PaletteBody onClose={close} onAsk={ask} initialQuery={initialQuery} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
