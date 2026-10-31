import { ErrorBlock, LoadingBlock } from '@/components/states'
import { Sheet } from '@/components/ui/sheet'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useSaleDetail } from './api'
import { describeRows } from './kpi-format'
import { formatDecimal } from './money'
import { SaleStatusPill } from './SaleStatus'
import { formatSaleTime } from './time'
import type { SaleLine } from './types'

function qty(v: string) {
  return v.replace(/\.?0+$/, '') || '0'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-caption font-medium text-muted">{children}</h3>
}

export function SaleSheet({ saleId, onClose, decimals, timeZone }: { saleId: string | null; onClose: () => void; decimals: number; timeZone?: string }) {
  const q = useSaleDetail(saleId)
  const sale = q.data
  const total = sale?.lines.reduce((s, l) => s + Number(l.net), 0) ?? 0
  const rows = (sale?.lines ?? []).map((l) => l.source_row).filter((n): n is number => n !== null)

  return (
    <Sheet
      open={!!saleId}
      onOpenChange={(o) => !o && onClose()}
      title={t('records.sheetTitle', { receipt: sale?.receipt_no ?? '' })}
      header={
        sale && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted">
            <SaleStatusPill status={sale.status} />
            <span className="mono">{formatSaleTime(sale.sold_at, timeZone)}</span>
            <span className="mono text-fg-2">{sale.branch_code}</span>
          </div>
        )
      }
    >
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : sale ? (
        <div className="flex flex-col gap-6 px-5 pt-2 pb-6">
          {(sale.ref_receipt_no || sale.customer_ref) && (
            <dl className="grid grid-cols-2 gap-3 text-body">
              {sale.ref_receipt_no && (
                <div>
                  <dt className="text-caption text-muted">{t('records.statuses.refund')}</dt>
                  <dd className="mono">{t('records.refundOf', { receipt: sale.ref_receipt_no })}</dd>
                </div>
              )}
              {sale.customer_ref && (
                <div>
                  <dt className="text-caption text-muted">{t('records.customer')}</dt>
                  <dd>{sale.customer_ref}</dd>
                </div>
              )}
            </dl>
          )}

          <section aria-labelledby="sale-lines" className="flex flex-col gap-2">
            <SectionLabel>
              <span id="sale-lines">{t('records.lines')}</span>
            </SectionLabel>
            <table className="w-full text-body">
              <thead>
                <tr className="text-caption text-muted">
                  <th scope="col" className="border-b border-line pb-1 text-start font-medium">{t('records.colItem')}</th>
                  <th scope="col" className="border-b border-line pb-1 text-end font-medium">{t('records.colQty')}</th>
                  <th scope="col" className="border-b border-line pb-1 text-end font-medium">{t('records.colNetCcy', { ccy: sale.currency })}</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((l: SaleLine) => (
                  <tr key={l.id}>
                    <td className="border-b border-line py-1.5 pe-3 align-top">
                      <span className="block text-fg">{l.name ?? l.description ?? l.sku ?? '–'}</span>
                      <span className="mono block text-muted">
                        {l.sku && <span>{l.sku} · </span>}
                        {formatDecimal(l.unit_price, decimals)}
                        {Number(l.discount) !== 0 && <span> − {formatDecimal(l.discount, decimals)}</span>}
                        {l.source_row !== null && <span className="sr-only">, {t('records.row', { n: l.source_row })}</span>}
                      </span>
                    </td>
                    <td className="num border-b border-line py-1.5 text-end align-top text-fg-2">{qty(l.qty)}</td>
                    <td className={cn('num border-b border-line py-1.5 text-end align-top', Number(l.net) < 0 && 'text-danger-text')}>{formatDecimal(l.net, decimals)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="pt-2 text-muted">
                    {t('records.total')}
                  </td>
                  <td className="num pt-2 text-end font-semibold text-fg">
                    {formatDecimal(total.toFixed(decimals), decimals)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section aria-labelledby="sale-source" className="flex flex-col gap-1.5">
            <SectionLabel>
              <span id="sale-source">{t('records.source')}</span>
            </SectionLabel>
            <p data-testid="sale-source" className="text-body text-fg-2">
              {sale.source.file_name && rows.length ? t('records.fromFile', { file: sale.source.file_name, rows: describeRows(rows) }) : (sale.source.file_name ?? t('records.noSource'))}
            </p>
          </section>
        </div>
      ) : null}
    </Sheet>
  )
}
