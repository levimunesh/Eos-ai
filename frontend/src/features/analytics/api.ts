import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useOrg } from '@/features/orgs/org-context'
import { useApi } from '@/lib/api-context'
import { qk } from '@/lib/query-keys'
import type { BreakdownOrder, BreakdownResponse, Dimension, KpiResponse, SaleDetail, SaleStatus, SalesPage } from './types'

export interface RangeParams {
  from: string
  to: string
  branchIds: string[]
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v))
  return u.toString()
}

function rangeQs(r: RangeParams) {
  return { from: r.from, to: r.to, branch_ids: r.branchIds.length ? r.branchIds.join(',') : undefined }
}

export function useKpis(r: RangeParams & { compare: boolean }, enabled = true) {
  const api = useApi()
  const { orgId } = useOrg()
  const q = qs({ ...rangeQs(r), compare: r.compare ? 'previous_period' : 'none' })
  return useQuery({
    queryKey: qk.kpis(orgId, q),
    queryFn: ({ signal }) => api.get<KpiResponse>(`/kpis?${q}`, { orgId, signal }),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useBreakdown(
  r: RangeParams & { dimension: Dimension; order?: BreakdownOrder; limit?: number },
  enabled = true,
) {
  const api = useApi()
  const { orgId } = useOrg()
  const q = qs({ ...rangeQs(r), dimension: r.dimension, order: r.order, limit: r.limit })
  return useQuery({
    queryKey: qk.breakdown(orgId, q),
    queryFn: ({ signal }) => api.get<BreakdownResponse>(`/analytics/sales?${q}`, { orgId, signal }),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useSalesRecords(
  r: RangeParams & { status?: SaleStatus | ''; receipt?: string; limit: number; offset: number },
  enabled = true,
) {
  const api = useApi()
  const { orgId } = useOrg()
  const q = qs({ ...rangeQs(r), status: r.status || undefined, receipt: r.receipt?.trim() || undefined, limit: r.limit, offset: r.offset })
  return useQuery({
    queryKey: qk.salesRecords(orgId, q),
    queryFn: ({ signal }) => api.get<SalesPage>(`/records/sales?${q}`, { orgId, signal }),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useSaleDetail(id: string | null) {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.saleDetail(orgId, id ?? ''),
    queryFn: ({ signal }) => api.get<SaleDetail>(`/records/sales/${id}`, { orgId, signal }),
    enabled: !!id,
  })
}
