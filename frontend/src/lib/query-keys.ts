export const qk = {
  me: ['me'] as const,
  org: (orgId: string) => ['org', orgId] as const,
  members: (orgId: string) => ['org', orgId, 'members'] as const,
  invitations: (orgId: string) => ['org', orgId, 'invitations'] as const,
  branches: (orgId: string) => ['org', orgId, 'branches'] as const,
  imports: (orgId: string) => ['org', orgId, 'imports'] as const,
  importItem: (orgId: string, id: string) => ['org', orgId, 'import', id] as const,
  kpis: (orgId: string, params: string) => ['org', orgId, 'kpis', params] as const,
  breakdown: (orgId: string, params: string) => ['org', orgId, 'breakdown', params] as const,
  salesRecords: (orgId: string, params: string) => ['org', orgId, 'sales', params] as const,
  saleDetail: (orgId: string, id: string) => ['org', orgId, 'sale', id] as const,
  importEntities: (orgId: string) => ['org', orgId, 'import-entities'] as const,
}
