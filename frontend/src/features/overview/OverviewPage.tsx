import { ArrowUp, Bot, Check, Store, Upload, Users, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { useOrg } from '@/features/orgs/org-context'
import { useImportsQuery } from '@/features/imports/api'
import { useBranchesQuery } from '@/lib/queries'
import { t, type StringKey } from '@/lib/strings'
import { cn } from '@/lib/utils'

const KPI_LABELS: StringKey[] = [
  'overview.kpis.netSales',
  'overview.kpis.transactions',
  'overview.kpis.avgTicket',
  'overview.kpis.grossProfit',
]

/** A dashed, flat placeholder line: shows where a trend will be drawn without implying one. */
function SkeletonSparkline() {
  return (
    <svg aria-hidden viewBox="0 0 120 32" preserveAspectRatio="none" className="h-8 w-full">
      <path d="M0 24 H120" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="3 4" fill="none" vectorEffect="non-scaling-stroke" />
      <path d="M0 31.5 H120" stroke="var(--line)" strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiPlaceholders() {
  return (
    <section aria-label={t('overview.kpiCaption')} data-testid="kpi-area">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPI_LABELS.map((key) => (
          <div key={key} className="surface-raised flex flex-col gap-3 rounded-xl p-4">
            <dt className="text-[0.8125rem] font-medium text-fg-2">{t(key)}</dt>
            <dd className="flex flex-col gap-3">
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-6 w-20 animate-pulse rounded-md bg-skeleton motion-reduce:animate-none" />
              </span>
              <SkeletonSparkline />
              <Badge tone="outline" className="self-start">
                {t('overview.awaiting')}
              </Badge>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-xs text-muted">{t('overview.kpiSoon')}</p>
    </section>
  )
}

interface Step {
  title: string
  body: string
  icon: LucideIcon
  to?: string
  action?: string
  done: boolean
  later?: boolean
}

function SetupChecklist() {
  const branches = useBranchesQuery()
  const imports = useImportsQuery()
  const hasBranches = (branches.data?.length ?? 0) > 0
  const hasImported = (imports.data ?? []).some((i) => i.status === 'done')
  const steps: Step[] = [
    {
      title: t('overview.setupBranches'),
      body: t('overview.setupBranchesBody'),
      icon: Store,
      to: '/settings/branches',
      action: t('overview.setupBranchesAction'),
      done: hasBranches,
    },
    {
      title: t('overview.setupMembers'),
      body: t('overview.setupMembersBody'),
      icon: Users,
      to: '/settings/members',
      action: t('overview.setupMembersAction'),
      done: false,
    },
    {
      title: t('overview.setupImport'),
      body: t('overview.setupImportBody'),
      icon: Upload,
      to: '/imports/new',
      action: t('overview.setupImportAction'),
      done: hasImported,
    },
  ]
  const done = steps.filter((s) => s.done).length
  const firstOpen = steps.findIndex((s) => !s.done && !s.later)

  return (
    <section aria-labelledby="setup-title" className="surface-raised overflow-hidden rounded-xl">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="setup-title" className="text-[0.9375rem] font-semibold">
            {t('overview.setupTitle')}
          </h2>
          <span className="text-xs text-muted tabular-nums">
            {t('overview.setupProgress', { done, total: steps.length })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t('overview.setupTitle')}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          className="h-1.5 overflow-hidden rounded-full bg-subtle"
        >
          <div
            className="h-full rounded-full bg-[image:var(--dawn)] transition-[width] duration-500"
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <ol>
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <li key={s.title} className="flex items-start gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:items-center">
              <span
                aria-hidden
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border',
                  s.done ? 'border-transparent bg-success-soft text-success' : 'border-line bg-subtle text-muted',
                )}
              >
                {s.done ? <Check className="size-4" strokeWidth={2.5} /> : <Icon className="size-4" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', s.done && 'text-muted line-through decoration-line-strong')}>
                    {s.title}
                    {s.done && <span className="sr-only"> ({t('overview.stepDone')})</span>}
                  </p>
                  <p className="text-sm text-muted">{s.body}</p>
                </div>
                {s.later ? (
                  <Badge tone="outline" className="self-start sm:self-center">
                    {t('common.comingLater')}
                  </Badge>
                ) : (
                  <Link
                    to={s.to!}
                    className={cn(
                      buttonVariants({ variant: i === firstOpen ? 'primary' : 'secondary', size: 'sm' }),
                      'self-start sm:self-center',
                    )}
                  >
                    {s.action}
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function AssistantPreview() {
  return (
    <section aria-labelledby="assistant-title" className="surface-raised flex flex-col overflow-hidden rounded-xl">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="assistant-title" className="flex items-center gap-2 text-[0.9375rem] font-semibold">
          <Bot aria-hidden className="size-4 text-accent-text" />
          {t('overview.assistantTitle')}
        </h2>
        <Badge tone="accent">{t('common.comingLater')}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-sm text-fg-2">{t('overview.assistantBody')}</p>
        <div className="mt-auto flex flex-col gap-1.5">
          <span className="text-xs text-muted">{t('overview.assistantExampleLabel')}</span>
          <div
            aria-disabled="true"
            className="flex items-center gap-2 rounded-lg border border-line bg-subtle/60 py-1.5 ps-3.5 pe-1.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-fg-2">{t('overview.assistantExample')}</span>
            <span
              aria-label={t('overview.assistantAsk')}
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-line text-muted"
            >
              <ArrowUp aria-hidden className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

export function OverviewPage() {
  const { membership, isOwner } = useOrg()
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title={t('overview.title')} description={membership.org_name} />

      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-semibold">{t('overview.emptyTitle')}</h2>
        <p className="max-w-[65ch] text-sm text-muted">{t('overview.emptyBody', { org: membership.org_name })}</p>
      </div>

      <KpiPlaceholders />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {isOwner ? (
          <SetupChecklist />
        ) : (
          <p className="surface-raised rounded-xl px-5 py-4 text-sm text-muted">{t('overview.viewerNote')}</p>
        )}
        <AssistantPreview />
      </div>
    </div>
  )
}
