import { Check, ChevronDown, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
import { daysBetween, PRESETS, SEGMENTS, type Preset } from './dates'
import type { Filters } from './filters'

const chipClass =
  'focus-field inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-body text-fg-2 transition-colors hover:border-line-strong hover:text-fg data-[state=open]:border-accent sm:h-7'

/** Segmented 7D / 30D / 90D / 12M plus a "Custom" trigger holding every other period. */
function PeriodControl({ filters, onChange, dateFormat }: { filters: Filters; onChange: (f: Partial<Filters>) => void; dateFormat?: DateFormat }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(filters.from)
  const [to, setTo] = useState(filters.to)
  const valid = !!from && !!to && from <= to && daysBetween(from, to) <= 3 * 366
  const isSegment = (SEGMENTS as string[]).includes(filters.preset)
  const label = t(`dashboard.presets.${filters.preset}` as StringKey)
  const range = `${formatDate(filters.from, dateFormat)} – ${formatDate(filters.to, dateFormat)}`
  const customLabel = isSegment ? t('dashboard.segments.custom') : filters.preset === 'custom' ? range : label

  return (
    <div role="radiogroup" aria-label={t('dashboard.period')} className="inline-flex h-9 shrink-0 items-center rounded-md border border-line bg-surface p-0.5 sm:h-7">
      {SEGMENTS.map((p) => {
        const on = filters.preset === p
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t(`dashboard.presets.${p}` as StringKey)}
            onClick={() => onChange({ preset: p })}
            className={cn(
              'mono h-full rounded-[4px] px-2 text-[0.75rem] font-medium transition-colors',
              on ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {t(`dashboard.segments.${p}` as StringKey)}
          </button>
        )
      })}
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
        <PopoverTrigger
          aria-pressed={!isSegment}
          aria-label={`${t('dashboard.period')}: ${label}, ${range}`}
          className={cn(
            'inline-flex h-full items-center gap-1 rounded-[4px] px-2 text-[0.75rem] font-medium transition-colors',
            !isSegment ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
          )}
        >
          <span className={cn('truncate', !isSegment && filters.preset === 'custom' && 'mono')}>{customLabel}</span>
          <ChevronDown aria-hidden className="size-3 shrink-0 text-muted" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-1.5">
          <ul role="listbox" aria-label={t('dashboard.morePresets')} className="flex flex-col">
            {PRESETS.filter((p) => !(SEGMENTS as string[]).includes(p)).map((p) => {
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
                    className={cn('flex h-9 w-full items-center gap-2 rounded-md px-2 text-start text-body hover:bg-surface-2 sm:h-7', selected && 'font-medium')}
                  >
                    <Check aria-hidden className={cn('size-3.5 text-fg', selected ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />
                    {t(`dashboard.presets.${p}` as StringKey)}
                  </button>
                </li>
              )
            })}
          </ul>
          <form
            className="mt-1.5 flex flex-col gap-2.5 border-t border-line px-2 pt-2.5 pb-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!valid) return
              onChange({ preset: 'custom' as Preset, from, to })
              setOpen(false)
            }}
          >
            <p className="text-caption text-muted">{t('dashboard.presets.custom')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Field id="range-from" label={t('dashboard.customFrom')}>
                <Input id="range-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mono px-2" />
              </Field>
              <Field id="range-to" label={t('dashboard.customTo')}>
                <Input id="range-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mono px-2" />
              </Field>
            </div>
            {!valid && from && to && <p role="alert" className="text-caption text-danger-text">{t('dashboard.badRange')}</p>}
            <Button type="submit" size="sm" disabled={!valid} className="self-start">
              {t('dashboard.apply')}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function CompareChip({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={t('dashboard.compare')}
      onClick={() => onChange(!on)}
      className={cn(chipClass, on ? 'text-fg' : 'border-dashed text-muted')}
    >
      {on ? (
        <>
          {t('dashboard.vsPreviousChip')}
          <X aria-hidden className="size-3 text-muted" />
        </>
      ) : (
        t('dashboard.compareOff')
      )}
    </button>
  )
}

function BranchChip({ branches, selected, onChange }: { branches: Branch[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const label =
    selected.length === 0
      ? t('dashboard.allBranches')
      : selected.length === 1
        ? (branches.find((b) => b.id === selected[0])?.code ?? t('dashboard.branchesSelected', { n: 1 }))
        : t('dashboard.branchesSelected', { n: selected.length })
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((x) => x !== id))

  return (
    <Popover>
      <PopoverTrigger className={chipClass} aria-label={`${t('dashboard.branches')}: ${label}`}>
        <span className={cn('truncate', selected.length === 1 && 'mono')}>{label}</span>
        <ChevronDown aria-hidden className="size-3 shrink-0 text-muted" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5">
        <fieldset>
          <legend className="px-2 pt-1 pb-1.5 text-caption text-muted">{t('dashboard.branches')}</legend>
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {branches.map((b) => {
              const id = `branch-filter-${b.id}`
              return (
                <li key={b.id} className="flex h-9 items-center gap-2.5 rounded-md px-2 hover:bg-surface-2 sm:h-8">
                  <Checkbox id={id} checked={selected.includes(b.id)} onCheckedChange={(v) => toggle(b.id, v === true)} />
                  <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 font-normal">
                    <span className="mono text-fg">{b.code}</span>
                    <span className="truncate text-fg-2">{b.name}</span>
                  </Label>
                </li>
              )
            })}
          </ul>
        </fieldset>
        {selected.length > 0 && (
          <div className="mt-1 border-t border-line px-0.5 pt-1">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onChange([])}>
              {t('dashboard.clearBranches')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * One sticky row: period segments, the comparison chip, the branch chip, any page-specific
 * controls, and freshness on the end side. On phones it scrolls sideways rather than wrapping.
 */
export function FilterBar({
  filters,
  onChange,
  branches,
  dateFormat,
  showCompare = true,
  children,
  meta,
}: {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  branches: Branch[]
  dateFormat?: DateFormat
  showCompare?: boolean
  children?: ReactNode
  /** End-side status: "Updated 42 min ago · 2 partial". */
  meta?: ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={t('dashboard.filters')}
      className="sticky top-11 z-20 -mx-4 flex items-center gap-2 overflow-x-auto border-b border-line bg-canvas/85 px-4 py-2 backdrop-blur-md [scrollbar-width:none] sm:-mx-6 sm:px-6"
    >
      <PeriodControl filters={filters} onChange={onChange} dateFormat={dateFormat} />
      {showCompare && <CompareChip on={filters.compare} onChange={(compare) => onChange({ compare })} />}
      {branches.length > 1 && <BranchChip branches={branches} selected={filters.branchIds} onChange={(ids) => onChange({ branchIds: ids })} />}
      {children}
      {meta && <div className="ms-auto flex shrink-0 items-center gap-2 ps-2 text-caption text-muted">{meta}</div>}
    </div>
  )
}
