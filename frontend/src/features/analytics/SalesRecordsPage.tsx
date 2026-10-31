import { ChevronLeft, ChevronRight, ReceiptText, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBranchesQuery, useOrgQuery } from '@/lib/queries'
import { t } from '@/lib/strings'
import { useSalesRecords } from './api'
import { FilterBar } from './FilterBar'
import { useFilters } from './filters'
import { formatCount, formatDecimal } from './money'
import { SaleSheet } from './SaleSheet'
import { SaleStatusPill } from './SaleStatus'
import { formatSaleTime } from './time'
import type { SaleStatus } from './types'

const PAGE = 50
const STATUSES: SaleStatus[] = ['completed', 'refund', 'voided']

export function SalesRecordsPage() {
  const org = useOrgQuery()
  const branches = useBranchesQuery()
  const { filters, update } = useFilters(org.data?.timezone)
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as SaleStatus | ''
  const receipt = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)
  const open = params.get('sale')
  const [search, setSearch] = useState(receipt)

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (v) n.set(k, v)
          else n.delete(k)
        }
        return n
      },
      { replace: true },
    )

  // Debounce the receipt search into the URL.
  useEffect(() => {
    if (search === receipt) return
    const id = window.setTimeout(() => set({ q: search.trim() || null, page: null }), 300)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const q = useSalesRecords({
    from: filters.from,
    to: filters.to,
    branchIds: filters.branchIds,
    status,
    receipt,
    limit: PAGE,
    offset: page * PAGE,
  })
  const decimals = org.data?.currency_decimals ?? 2
  const tz = org.data?.timezone
  const total = q.data?.total ?? 0
  const first = total ? page * PAGE + 1 : 0
  const last = Math.min(total, (page + 1) * PAGE)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('records.title')} description={t('records.description')} />
      <FilterBar
        filters={filters}
        onChange={(f) => {
          update(f)
          set({ page: null })
        }}
        branches={branches.data ?? []}
        dateFormat={org.data?.date_format}
        showCompare={false}
      >
        <Select
          aria-label={t('records.status')}
          value={status}
          onChange={(e) => set({ status: e.target.value || null, page: null })}
          className="w-auto min-w-36"
        >
          <option value="">{t('records.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`records.statuses.${s}`)}
            </option>
          ))}
        </Select>
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            aria-label={t('records.search')}
            placeholder={t('records.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
      </FilterBar>

      <Card>
        {q.isPending ? (
          <LoadingBlock rows={6} />
        ) : q.isError ? (
          <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.rows.length === 0 ? (
          <EmptyState icon={ReceiptText} title={t('records.emptyTitle')} body={t('records.emptyBody')} />
        ) : (
          <>
            <Table aria-label={t('records.tableLabel')} aria-busy={q.isFetching}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('records.colReceipt')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('records.colDate')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('records.colBranch')}</TableHead>
                  <TableHead>{t('records.colStatus')}</TableHead>
                  <TableHead className="hidden text-end md:table-cell">{t('records.colLines')}</TableHead>
                  <TableHead className="text-end">{t('records.colNet')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => set({ sale: r.id })}>
                    <TableCell>
                      <button
                        type="button"
                        aria-label={t('records.open', { receipt: r.receipt_no })}
                        onClick={(e) => {
                          e.stopPropagation()
                          set({ sale: r.id })
                        }}
                        className="font-medium tabular-nums hover:underline"
                      >
                        {r.receipt_no}
                      </button>
                      <span className="block text-xs text-muted tabular-nums sm:hidden">
                        {formatSaleTime(r.sold_at, tz)}, {r.branch_code}
                      </span>
                      {r.ref_receipt_no && <span className="block text-xs text-muted">{t('records.refundOf', { receipt: r.ref_receipt_no })}</span>}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-fg-2 tabular-nums sm:table-cell">{formatSaleTime(r.sold_at, tz)}</TableCell>
                    <TableCell className="hidden font-medium tabular-nums md:table-cell">{r.branch_code}</TableCell>
                    <TableCell>
                      <SaleStatusPill status={r.status} />
                    </TableCell>
                    <TableCell className="hidden text-end text-fg-2 tabular-nums md:table-cell">{formatCount(r.lines)}</TableCell>
                    <TableCell className="text-end whitespace-nowrap tabular-nums">
                      <span className="me-1 text-xs text-muted">{r.currency}</span>
                      <span className="font-medium">{formatDecimal(r.net, decimals)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <nav aria-label={t('records.tableLabel')} className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
              <p className="text-xs text-muted tabular-nums">
                {t('records.showing', { from: formatCount(first), to: formatCount(last), total: formatCount(total) })}
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={t('records.previous')} disabled={page === 0} onClick={() => set({ page: page > 1 ? String(page - 1) : null })}>
                  <ChevronLeft className="rtl:-scale-x-100" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t('records.next')} disabled={last >= total} onClick={() => set({ page: String(page + 1) })}>
                  <ChevronRight className="rtl:-scale-x-100" />
                </Button>
              </div>
            </nav>
          </>
        )}
      </Card>

      <SaleSheet saleId={open} onClose={() => set({ sale: null })} decimals={decimals} timeZone={tz} />
    </div>
  )
}
