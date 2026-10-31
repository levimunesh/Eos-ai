import { Check, Store, Upload, Users, type LucideIcon } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { LoadingBlock, PageHeader } from '@/components/states'
import { AiMark } from '@/app/Wordmark'
import { useShell } from '@/app/shell-context'
import { buttonVariants } from '@/components/ui/button'
import { useOrg } from '@/features/orgs/org-context'
import { useImportsQuery } from '@/features/imports/api'
import { useBranchesQuery } from '@/lib/queries'
import { en, t, type StringKey } from '@/lib/strings'
import { cn } from '@/lib/utils'

// Charts are heavy; load them only once there is data to show.
const Dashboard = lazy(() => import('@/features/analytics/Dashboard').then((m) => ({ default: m.Dashboard })))

const KPI_LABELS: StringKey[] = [
  'overview.kpis.netSales',
  'overview.kpis.transactions',
  'overview.kpis.avgTicket',
  'overview.kpis.grossProfit',
]

/** A faint dawn-tinted silhouette where the hero line will be drawn. Implies nothing. */
function DawnSilhouette() {
  return (
    <svg aria-hidden viewBox="0 0 600 120" preserveAspectRatio="none" className="h-28 w-full">
      <defs>
        <linearGradient id="dawn-silhouette" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f5a05a" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="#e0577a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#7a5af0" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <path d="M0 96 C 80 92, 120 70, 190 74 S 300 98, 360 80 S 470 40, 540 46 S 590 30, 600 28" fill="none" stroke="url(#dawn-silhouette)" strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
      <path d="M0 119 H600" stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiPlaceholders() {
  const { isOwner } = useOrg()
  return (
    <section aria-label={t('overview.kpiCaption')} data-testid="kpi-area" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="card-flat flex flex-col gap-3 p-4">
        <p className="text-body text-fg-2">{t('overview.kpis.netSales')}</p>
        <p className="text-display text-muted/40">—</p>
        <DawnSilhouette />
        <p className="text-body text-fg-2">{t('overview.emptyHero')}</p>
        {isOwner && (
          <Link to="/imports/new" className={cn(buttonVariants({ size: 'sm' }), 'self-start')}>
            {t('overview.setupImportAction')}
          </Link>
        )}
      </div>
      <dl className="card-flat flex flex-col divide-y divide-line px-4 py-2">
        {KPI_LABELS.filter((k) => k !== 'overview.kpis.netSales').map((key) => (
          <div key={key} className="flex items-center justify-between py-2.5">
            <dt className="text-body text-fg-2">{t(key)}</dt>
            <dd className="text-caption text-muted">{t('overview.awaiting')}</dd>
          </div>
        ))}
        <p className="pt-2.5 text-caption text-muted">{t('overview.kpiSoon')}</p>
      </dl>
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
    { title: t('overview.setupBranches'), body: t('overview.setupBranchesBody'), icon: Store, to: '/settings/branches', action: t('overview.setupBranchesAction'), done: hasBranches },
    { title: t('overview.setupMembers'), body: t('overview.setupMembersBody'), icon: Users, to: '/settings/members', action: t('overview.setupMembersAction'), done: false },
    { title: t('overview.setupImport'), body: t('overview.setupImportBody'), icon: Upload, to: '/imports/new', action: t('overview.setupImportAction'), done: hasImported },
  ]
  const done = steps.filter((s) => s.done).length
  const firstOpen = steps.findIndex((s) => !s.done && !s.later)

  return (
    <section aria-labelledby="setup-title" className="card-flat flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        <h2 id="setup-title" className="text-title">
          {t('overview.setupTitle')}
        </h2>
        <span
          role="progressbar"
          aria-label={t('overview.setupTitle')}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          className="mono text-muted"
        >
          {t('overview.setupProgress', { done, total: steps.length })}
        </span>
      </div>
      <ol>
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <li key={s.title} className="flex items-start gap-3 border-t border-line px-4 py-3 sm:items-center">
              <span aria-hidden className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full sm:mt-0', s.done ? 'bg-success-soft text-success' : 'border border-line text-muted')}>
                {s.done ? <Check className="size-3" strokeWidth={2.5} /> : <Icon className="size-3" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className={cn('text-body font-medium', s.done && 'text-muted line-through decoration-line-strong')}>
                    {s.title}
                    {s.done && <span className="sr-only"> ({t('overview.stepDone')})</span>}
                  </p>
                  <p className="text-body text-muted">{s.body}</p>
                </div>
                <Link to={s.to!} className={cn(buttonVariants({ variant: i === firstOpen ? 'primary' : 'secondary', size: 'sm' }), 'self-start sm:self-center')}>
                  {s.action}
                </Link>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function AssistantPreview() {
  const { ask } = useShell()
  return (
    <section aria-labelledby="assistant-title" className="dawn-hairline dawn-rule flex flex-col gap-3 rounded-lg px-4 py-3.5 ps-5">
      <h2 id="assistant-title" className="flex items-center gap-2 text-title">
        <AiMark />
        {t('overview.assistantTitle')}
      </h2>
      <p className="text-body text-fg-2">{t('overview.assistantBody')}</p>
      <ul className="flex flex-col gap-1">
        {en.assistant.examples.slice(0, 2).map((ex) => (
          <li key={ex}>
            <button type="button" onClick={() => ask(ex)} className="w-full rounded-md border border-line px-3 py-1.5 text-start text-body text-fg-2 hover:border-line-strong hover:text-fg">
              {ex}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EmptyOverview() {
  const { membership, isOwner } = useOrg()
  return (
    <div className="flex flex-col gap-5">
      <div className="flex max-w-[60ch] flex-col gap-1">
        <h2 className="text-[0.9375rem] font-semibold">{t('overview.emptyTitle')}</h2>
        <p className="text-body text-muted">{t('overview.emptyBody', { org: membership.org_name })}</p>
      </div>

      <KpiPlaceholders />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {isOwner ? (
          <SetupChecklist />
        ) : (
          <p className="card-flat px-4 py-3 text-body text-muted">{t('overview.viewerNote')}</p>
        )}
        <AssistantPreview />
      </div>
    </div>
  )
}

export function OverviewPage() {
  const { membership, role } = useOrg()
  // Managers and owners can list imports; viewers can't, so for them the KPI response decides.
  const imports = useImportsQuery(role !== 'viewer')
  const hasImported = role === 'viewer' || (imports.data ?? []).some((i) => i.status === 'done')
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={membership.org_name} />
      {role !== 'viewer' && imports.isPending ? (
        <LoadingBlock />
      ) : hasImported ? (
        <Suspense fallback={<LoadingBlock />}>
          <Dashboard empty={<EmptyOverview />} />
        </Suspense>
      ) : (
        <EmptyOverview />
      )}
    </div>
  )
}
