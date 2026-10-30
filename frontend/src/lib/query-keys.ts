export const qk = {
  me: ['me'] as const,
  org: (orgId: string) => ['org', orgId] as const,
  members: (orgId: string) => ['org', orgId, 'members'] as const,
  invitations: (orgId: string) => ['org', orgId, 'invitations'] as const,
  branches: (orgId: string) => ['org', orgId, 'branches'] as const,
}
