import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/strings'
import type { SaleStatus } from './types'

const TONE: Record<SaleStatus, 'success' | 'warning' | 'neutral'> = { completed: 'success', refund: 'warning', voided: 'neutral' }

/** Status as a 6px dot plus text; no pill fill. */
export function SaleStatusPill({ status }: { status: SaleStatus }) {
  return (
    <Badge tone={TONE[status]} dot>
      {t(`records.statuses.${status}`)}
    </Badge>
  )
}
