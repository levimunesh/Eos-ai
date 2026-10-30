import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { inputClass } from './input'

export interface ComboOption {
  value: string
  label: string
  hint?: string
}

interface ComboboxProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: ComboOption[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  'aria-describedby'?: string
  onBlur?: () => void
}

/** Searchable single select: a trigger button opening a filterable listbox. */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  invalid,
  onBlur,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.value.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  function openList() {
    const idx = Math.max(0, options.findIndex((o) => o.value === value))
    setQuery('')
    setActive(idx)
    setOpen(true)
  }

  function close(refocus = true) {
    setOpen(false)
    onBlur?.()
    if (refocus) triggerRef.current?.focus()
  }

  function choose(opt: ComboOption) {
    onChange(opt.value)
    close()
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[active]
      if (opt) choose(opt)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={aria['aria-describedby']}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            openList()
          }
        }}
        className={cn(inputClass, 'flex items-center justify-between gap-2 text-start', open && 'border-accent shadow-[0_0_0_3px_var(--ring-halo)]')}
      >
        <span className={cn('truncate', !selected && 'text-muted')}>
          {selected ? (
            <>
              <span className="font-medium">{selected.label}</span>
              {selected.hint && <span className="text-muted"> {selected.hint}</span>}
            </>
          ) : (
            placeholder ?? t('common.select')
          )}
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div data-state="open" className="anim-menu absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border border-line bg-elevated shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search aria-hidden className="size-4 text-muted" />
            <input
              ref={searchRef}
              role="combobox"
              aria-label={t('common.search')}
              aria-controls={listId}
              aria-expanded
              aria-autocomplete="list"
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKey}
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted sm:h-10"
              placeholder={t('common.search')}
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t('common.noMatches')}</li>}
            {filtered.map((opt, i) => (
              <li
                key={opt.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={opt.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(opt)}
                onMouseMove={() => setActive(i)}
                className={cn(
                  'mx-1 flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 text-sm sm:min-h-8',
                  i === active && 'bg-subtle',
                )}
              >
                <Check
                  aria-hidden
                  className={cn('size-4 shrink-0 text-accent-text', opt.value === value ? 'opacity-100' : 'opacity-0')}
                />
                <span className="font-medium tabular-nums">{opt.label}</span>
                {opt.hint && <span className="truncate text-muted">{opt.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
