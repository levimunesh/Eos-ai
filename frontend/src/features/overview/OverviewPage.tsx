import { Check } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { useOrg } from '@/features/orgs/org-context'
import { useBranchesQuery } from '@/lib/queries'
import { t, type StringKey } from '@/lib/strings'
import { cn } from '@/lib/utils'

const KPI_LABELS: StringKey[] = [
  'overview.kpis.netSales',
  'overview.kpis.transactions',
  'overview.kpis.avgTicket',
  'overview.kpis.grossProfit',
]

/** The four headline KPI slots, deliberately empty: a ruled field where each figure will sit. */
function KpiPlaceholders() {
  return (
    <section aria-label={t('overview.kpiCaption')} data-testid="kpi-area">
      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4">
        {KPI_LABELS.map((key, i) => (
          <div
            key={key}
            className={cn(
              'flex flex-col gap-3 p-4 sm:p-5',
              i % 2 === 1 && 'border-s border-line',
              i >= 2 && 'border-t border-line lg:border-t-0',
              i === 2 && 'lg:border-s',
            )}
          >
            <dt className="text-sm text-muted">{t(key)}</dt>
            <dd className="kpi-slot flex h-10 items-center rounded-sm px-2">
              <span className="rounded-sm bg-surface px-1.5 text-xs text-muted">{t('overview.awaiting')}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">{t('overview.kpiCaption')}</p>
    </section>
  )
}

function SetupSteps() {
  const branches = useBranchesQuery()
  const hasBranches = (branches.data?.length ?? 0) > 0
  const steps = [
    {
      title: t('overview.setupBranches'),
      body: t('overview.setupBranchesBody'),
      to: '/settings/branches',
      action: t('overview.setupBranchesAction'),
      done: hasBranches,
    },
    {
      title: t('overview.setupMembers'),
      body: t('overview.setupMembersBody'),
      to: '/settings/members',
      action: t('overview.setupMembersAction'),
      done: false,
    },
    { title: t('overview.setupImport'), body: t('overview.setupImportBody'), later: true, done: false },
  ]
  return (
    <section aria-labelledby="setup-title" className="rounded-lg border border-line bg-surface">
      <h2 id="setup-title" className="border-b border-line px-5 py-4 text-base font-semibold">
        {t('overview.setupTitle')}
      </h2>
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-4 px-5 py-4 sm:items-center sm:gap-5">
            <span
              aria-hidden
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
                s.done ? 'border-signal bg-signal text-white' : 'border-line-strong text-ink-2',
              )}
            >
              {s.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', s.later && 'text-muted')}>{s.title}</p>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
            {s.later ? (
              <Badge tone="outline" className="self-start sm:self-center">
                {t('common.comingLater')}
              </Badge>
            ) : (
              <Link
                to={s.to!}
                className={cn(buttonVariants({ variant: i === 0 && !s.done ? 'primary' : 'secondary', size: 'sm' }), 'self-start sm:self-center')}
              >
                {s.action}
              </Link>
            )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function OverviewPage() {
  const { membership, isOwner } = useOrg()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('overview.title')} description={membership.org_name} />

      <div className="flex flex-col gap-2 border-s-2 border-petrol-500 ps-4">
        <h2 className="font-display text-xl font-semibold">{t('overview.emptyTitle')}</h2>
        <p className="max-w-[65ch] text-sm text-ink-2">
          {t('overview.emptyBody', { org: membership.org_name })}
        </p>
      </div>

      <KpiPlaceholders />

      {isOwner ? (
        <SetupSteps />
      ) : (
        <p className="max-w-[65ch] rounded-lg border border-line bg-surface px-5 py-4 text-sm text-muted">
          {t('overview.viewerNote')}
        </p>
      )}
    </div>
  )
}
