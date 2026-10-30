import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Building2, CornerDownLeft, Moon, Plus, Search, Store, Sun, UserPlus, type LucideIcon } from 'lucide-react'
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '@/components/ui/avatar'
import { useOrg } from '@/features/orgs/org-context'
import { t } from '@/lib/strings'
import { useTheme } from '@/lib/theme-context'
import { useModHotkey } from '@/lib/use-hotkey'
import { cn } from '@/lib/utils'
import { PRIMARY_NAV, visibleSettings } from './nav'

interface Command {
  id: string
  group: string
  label: string
  icon?: LucideIcon
  avatar?: { name: string; seed: string }
  keywords?: string
  run: () => void
}

function useCommands(close: () => void): Command[] {
  const navigate = useNavigate()
  const { me, orgId, role, isOwner, switchOrg } = useOrg()
  const { resolved, toggle } = useTheme()

  return useMemo(() => {
    const go = (to: string) => () => {
      close()
      navigate(to)
    }
    const nav: Command[] = [...PRIMARY_NAV.filter((n) => !n.disabled), ...visibleSettings(role)].map((n) => ({
      id: `nav:${n.to}`,
      group: t('palette.groupNavigate'),
      label: t(n.label),
      icon: n.icon,
      keywords: n.to,
      run: go(n.to),
    }))
    const actions: Command[] = []
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
    return [...nav, ...actions, ...orgs]
  }, [close, navigate, me.memberships, orgId, role, isOwner, switchOrg, resolved, toggle])
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const commands = useCommands(onClose)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase().includes(q))
  }, [commands, query])

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
      filtered[active]?.run()
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search aria-hidden className="size-4 shrink-0 text-muted" />
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
          className="h-14 w-full bg-transparent text-[0.9375rem] text-fg outline-none placeholder:text-muted"
        />
      </div>
      <div ref={listRef} id={listId} role="listbox" aria-label={t('palette.title')} className="max-h-[min(60dvh,24rem)] overflow-y-auto p-1.5">
        {filtered.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted">{t('palette.empty', { query })}</p>
        )}
        {filtered.map((c, i) => {
          const header = i === 0 || filtered[i - 1].group !== c.group ? c.group : null
          const Icon = c.icon
          return (
            <div key={c.id}>
              {header && <p className="px-2.5 pt-2.5 pb-1 text-xs font-medium text-muted">{header}</p>}
              <div
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => c.run()}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 text-sm sm:min-h-10',
                  i === active ? 'bg-subtle text-fg' : 'text-fg-2',
                )}
              >
                {c.avatar ? (
                  <Avatar name={c.avatar.name} seed={c.avatar.seed} className="size-5 rounded text-[0.5625rem]" />
                ) : Icon ? (
                  <Icon aria-hidden className={cn('size-4', i === active ? 'text-accent-text' : 'text-muted')} />
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
      <p className="hidden border-t border-line bg-subtle/60 px-4 py-2 text-xs text-muted sm:block">{t('palette.hint')}</p>
    </>
  )
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const toggle = useCallback(() => onOpenChange(!open), [onOpenChange, open])
  useModHotkey('k', toggle)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="anim-dialog fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-elevated pb-[env(safe-area-inset-bottom)] shadow-lg focus:outline-none sm:inset-x-4 sm:top-[14vh] sm:bottom-auto sm:mx-auto sm:max-w-xl sm:rounded-xl sm:pb-0"
        >
          <DialogPrimitive.Title className="sr-only">{t('palette.title')}</DialogPrimitive.Title>
          {open && <PaletteBody onClose={close} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
