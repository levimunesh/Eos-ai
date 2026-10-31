import { CalendarRange, Check, ChevronDown, Store } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate } from '@/lib/format'
import { t, type StringKey } from '@/lib/strings'
import type { Branch, DateFormat } from '@/lib/types'
import { cn } from '@/lib/utils'
import { daysBetween, PRESETS, type Preset } from './dates'
import type { Filters } from './filters'

const triggerClass =
  'focus-field inline-flex h-11 min-w-0 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm text-fg shadow-xs transition-colors hover:bg-subtle data-[state=open]:border-accent data-[state=open]:shadow-[0_0_0_3px_var(--ring-halo)] sm:h-9'

function PeriodPicker({
  filters,
  onChange,
  dateFormat,
}: {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  dateFormat?: DateFormat
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(filters.from)
  const [to, setTo] = useState(filters.to)
  const valid = !!from && !!to && from <= to && daysBetween(from, to) <= 3 * 366
  const label = t(`dashboard.presets.${filters.preset}` as StringKey)
  const range = `${formatDate(filters.from, dateFormat)} – ${formatDate(filters.to, dateFormat)}`

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setFrom(filters.from)
          setTo(filters.to)
        }
      }}
    >
      <PopoverTrigger className={triggerClass} aria-label={`${t('dashboard.period')}: ${label}, ${range}`}>
        <CalendarRange aria-hidden className="size-4 shrink-0 text-muted" />
        <span className="font-medium">{label}</span>
        <span className="hidden truncate text-muted tabular-nums sm:inline">{range}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-1.5">
        <ul role="listbox" aria-label={t('dashboard.period')} className="flex flex-col">
          {PRESETS.map((p) => {
            const selected = filters.preset === p
            return (
              <li key={p}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange({ preset: p })
                    setOpen(false)
                  }}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-start text-sm hover:bg-subtle sm:min-h-8',
                    selected && 'font-medium',
                  )}
                >
                  <Check aria-hidden className={cn('size-4 text-accent-text', selected ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />
                  {t(`dashboard.presets.${p}` as StringKey)}
                </button>
              </li>
            )
          })}
        </ul>
        <form
          className="mt-1.5 flex flex-col gap-3 border-t border-line px-2.5 pt-3 pb-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            onChange({ preset: 'custom' as Preset, from, to })
            setOpen(false)
          }}
        >
          <p className="text-xs font-medium text-muted">{t('dashboard.presets.custom')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field id="range-from" label={t('dashboard.customFrom')}>
              <Input id="range-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="px-2 tabular-nums" />
            </Field>
            <Field id="range-to" label={t('dashboard.customTo')}>
              <Input id="range-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="px-2 tabular-nums" />
            </Field>
          </div>
          {!valid && from && to && <p role="alert" className="text-xs text-danger-text">{t('dashboard.badRange')}</p>}
          <Button type="submit" size="sm" disabled={!valid}>
            {t('dashboard.apply')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function BranchPicker({
  branches,
  selected,
  onChange,
}: {
  branches: Branch[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const label =
    selected.length === 0
      ? t('dashboard.allBranches')
      : selected.length === 1
        ? (branches.find((b) => b.id === selected[0])?.code ?? t('dashboard.branchesSelected', { n: 1 }))
        : t('dashboard.branchesSelected', { n: selected.length })
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((x) => x !== id))

  return (
    <Popover>
      <PopoverTrigger className={triggerClass} aria-label={`${t('dashboard.branches')}: ${label}`}>
        <Store aria-hidden className="size-4 shrink-0 text-muted" />
        <span className="truncate font-medium">{label}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted" />
      </PopoverTrigger>
      <PopoverContent className="p-1.5">
        <fieldset>
          <legend className="px-2.5 pt-1 pb-1.5 text-xs font-medium text-muted">{t('dashboard.branches')}</legend>
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {branches.map((b) => {
              const id = `branch-filter-${b.id}`
              return (
                <li key={b.id} className="flex min-h-11 items-center gap-3 rounded-md px-2.5 hover:bg-subtle sm:min-h-9">
                  <Checkbox id={id} checked={selected.includes(b.id)} onCheckedChange={(v) => toggle(b.id, v === true)} />
                  <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer gap-2 font-normal">
                    <span className="font-medium tabular-nums">{b.code}</span>
                    <span className="truncate text-fg-2">{b.name}</span>
                  </Label>
                </li>
              )
            })}
          </ul>
        </fieldset>
        {selected.length > 0 && (
          <div className="mt-1.5 border-t border-line px-1 pt-1.5">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange([])}>
              {t('dashboard.clearBranches')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function FilterBar({
  filters,
  onChange,
  branches,
  dateFormat,
  showCompare = true,
  children,
}: {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  branches: Branch[]
  dateFormat?: DateFormat
  showCompare?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={t('dashboard.filters')}
      className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-canvas/90 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
    >
      <PeriodPicker filters={filters} onChange={onChange} dateFormat={dateFormat} />
      {branches.length > 1 && <BranchPicker branches={branches} selected={filters.branchIds} onChange={(ids) => onChange({ branchIds: ids })} />}
      {children}
      {showCompare && (
        <label className="ms-auto inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-fg-2 select-none sm:min-h-9">
          <span className="hidden md:inline">{t('dashboard.compare')}</span>
          <span className="md:hidden">{t('dashboard.compareShort')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={filters.compare}
            aria-label={t('dashboard.compare')}
            onClick={() => onChange({ compare: !filters.compare })}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              filters.compare ? 'bg-accent' : 'bg-line-strong',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute top-0.5 size-4 rounded-full bg-white shadow-xs transition-[inset-inline-start] duration-150',
                filters.compare ? 'start-[1.125rem]' : 'start-0.5',
              )}
            />
          </button>
        </label>
      )}
    </div>
  )
}
