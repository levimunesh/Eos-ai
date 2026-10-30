import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/features/orgs/org-context'
import { useApi } from '@/lib/api-context'
import { qk } from '@/lib/query-keys'
import type { ConflictMode, EntityType, ImportOptions, ImportRecord, ImportStatus, ImportSummary } from './types'

const BUSY: ImportStatus[] = ['validating', 'importing']
export const POLL_MS = 1500

export function useEntitiesQuery() {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.importEntities(orgId),
    queryFn: ({ signal }) => api.get<EntityType[]>('/imports/entities', { orgId, signal }),
    staleTime: 10 * 60_000,
  })
}

export function useImportsQuery(enabled = true) {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.imports(orgId),
    queryFn: ({ signal }) => api.get<ImportSummary[]>('/imports', { orgId, signal }),
    enabled,
    // Keep the history fresh while anything is running.
    refetchInterval: (q) => (q.state.data?.some((i) => BUSY.includes(i.status)) ? POLL_MS * 2 : false),
  })
}

/** Loads one import and polls while a background job is running. Polling stops on unmount. */
export function useImportQuery(id: string | null) {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.importItem(orgId, id ?? ''),
    queryFn: ({ signal }) => api.get<ImportRecord>(`/imports/${id}`, { orgId, signal }),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && BUSY.includes(q.state.data.status) ? POLL_MS : false),
    refetchIntervalInBackground: true,
    staleTime: 0,
  })
}

function useImportCache() {
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return (rec: ImportRecord) => {
    qc.setQueryData(qk.importItem(orgId, rec.id), rec)
    void qc.invalidateQueries({ queryKey: qk.imports(orgId) })
  }
}

export function useUploadImport() {
  const api = useApi()
  const { orgId } = useOrg()
  const store = useImportCache()
  return useMutation({
    mutationFn: ({ entityType, file, onProgress }: { entityType: string; file: File; onProgress?: (f: number) => void }) => {
      const form = new FormData()
      form.append('entity_type', entityType)
      form.append('file', file, file.name)
      return api.upload<ImportRecord>('/imports', form, { orgId, onProgress })
    },
    onSuccess: store,
  })
}

export function useSaveMapping() {
  const api = useApi()
  const { orgId } = useOrg()
  const store = useImportCache()
  return useMutation({
    mutationFn: ({ id, columnMap, options }: { id: string; columnMap: Record<string, string | null>; options: ImportOptions }) =>
      api.put<ImportRecord>(`/imports/${id}/mapping`, { column_map: columnMap, options }, { orgId }),
    onSuccess: store,
  })
}

export function useValidateImport() {
  const api = useApi()
  const { orgId } = useOrg()
  const store = useImportCache()
  return useMutation({
    mutationFn: (id: string) => api.post<ImportRecord>(`/imports/${id}/validate`, undefined, { orgId }),
    onSuccess: store,
  })
}

export function useCommitImport() {
  const api = useApi()
  const { orgId } = useOrg()
  const store = useImportCache()
  return useMutation({
    mutationFn: ({ id, conflictMode }: { id: string; conflictMode: ConflictMode }) =>
      api.post<ImportRecord>(`/imports/${id}/commit`, { conflict_mode: conflictMode }, { orgId }),
    onSuccess: store,
  })
}

/** Fetches the error rows CSV with auth headers and hands it to the browser as a download. */
export function useDownloadErrors() {
  const api = useApi()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const blob = await api.blob(`/imports/${id}/errors.csv`, orgId)
      const stem = fileName.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(blob)
      try {
        const a = document.createElement('a')
        a.href = url
        a.download = `${stem}-errors.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    },
  })
}
