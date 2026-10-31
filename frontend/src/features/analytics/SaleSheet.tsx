import * as DialogPrimitive from '@radix-ui/react-dialog'
import { FileSpreadsheet, X } from 'lucide-react'
import { ErrorBlock, LoadingBlock } from '@/components/states'
import { t } from '@/lib/strings'
import { useSaleDetail } from './api'
import { describeRows } from './kpi-format'
import { formatDecimal } from './money'
import { SaleStatusPill } from './SaleStatus'
import { formatSaleTime } from './time'
import type { SaleLine } from './types'

function qty(v: string) {
  return v.replace(/\.?0+$/, '') || '0'
}

export function SaleSheet({
  saleId,
  onClose,
  decimals,
  timeZone,
}: {
  saleId: string | null
  onClose: () => void
  decimals: number
  timeZone?: string
}) {
  const q = useSaleDetail(saleId)
  const sale = q.data
  const total = sale?.lines.reduce((s, l) => s + Number(l.net), 0) ?? 0
  const rows = (sale?.lines ?? []).map((l) => l.source_row).filter((n): n is number => n !== null)

  return (
    <DialogPrimitive.Root open={!!saleId} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Land on the heading, not the close button, so nothing looks pre-selected.
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>('h2')?.focus()
          }}
          className="anim-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-elevated pb-[env(safe-area-inset-bottom)] shadow-lg focus:outline-none sm:inset-y-0 sm:start-auto sm:end-0 sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-s-xl sm:border-e-0"
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
          <header className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title tabIndex={-1} className="text-base font-semibold tracking-tight focus:outline-none">
                {t('records.sheetTitle', { receipt: sale?.receipt_no ?? '' })}
              </DialogPrimitive.Title>
              {sale && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  <SaleStatusPill status={sale.status} />
                  <span className="tabular-nums">{formatSaleTime(sale.sold_at, timeZone)}</span>
                  <span className="font-medium text-fg-2 tabular-nums">{sale.branch_code}</span>
                </div>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label={t('common.close')}
              className="-me-2 flex size-11 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg sm:size-8"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </header>

          <div className="flex-1 overflow-y-auto">
            {q.isPending ? (
              <LoadingBlock />
            ) : q.isError ? (
              <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
            ) : sale ? (
              <div className="flex flex-col gap-5 px-5 py-4">
                {(sale.ref_receipt_no || sale.customer_ref) && (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {sale.ref_receipt_no && (
                      <div>
                        <dt className="text-xs text-muted">{t('records.statuses.refund')}</dt>
                        <dd className="tabular-nums">{t('records.refundOf', { receipt: sale.ref_receipt_no })}</dd>
                      </div>
                    )}
                    {sale.customer_ref && (
                      <div>
                        <dt className="text-xs text-muted">{t('records.customer')}</dt>
                        <dd>{sale.customer_ref}</dd>
                      </div>
                    )}
                  </dl>
                )}

                <section aria-labelledby="sale-lines" className="flex flex-col gap-2">
                  <h3 id="sale-lines" className="text-sm font-semibold">
                    {t('records.lines')}
                  </h3>
                  <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
                    {sale.lines.map((l: SaleLine) => (
                      <li key={l.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{l.name ?? l.description ?? l.sku ?? '–'}</p>
                          <p className="text-xs text-muted tabular-nums">
                            {l.sku && <span>{l.sku} </span>}
                            {qty(l.qty)} {'×'} {formatDecimal(l.unit_price, decimals)}
                            {Number(l.discount) !== 0 && (
                              <span>
                                {' '}
                                ({t('records.colDiscount')} {formatDecimal(l.discount, decimals)})
                              </span>
                            )}
                            {l.source_row !== null && <span className="sr-only">, {t('records.row', { n: l.source_row })}</span>}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums">{formatDecimal(l.net, decimals)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-baseline justify-between px-3.5 pt-1 text-sm">
                    <span className="text-muted">{t('records.total')}</span>
                    <span className="font-semibold tabular-nums">
                      <span className="me-1 text-xs font-medium text-muted">{sale.currency}</span>
                      {formatDecimal(total.toFixed(decimals), decimals)}
                    </span>
                  </div>
                </section>

                <section aria-labelledby="sale-source" className="flex flex-col gap-2">
                  <h3 id="sale-source" className="text-sm font-semibold">
                    {t('records.source')}
                  </h3>
                  <p data-testid="sale-source" className="flex items-start gap-2.5 rounded-lg bg-subtle px-3.5 py-3 text-sm text-fg-2 ring-1 ring-line ring-inset">
                    <FileSpreadsheet aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    {sale.source.file_name && rows.length
                      ? t('records.fromFile', { file: sale.source.file_name, rows: describeRows(rows) })
                      : sale.source.file_name ?? t('records.noSource')}
                  </p>
                </section>
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
