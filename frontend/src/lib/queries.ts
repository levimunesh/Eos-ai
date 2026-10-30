import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/features/orgs/org-context'
import { useApi } from './api-context'
import { qk } from './query-keys'
import type {
  Branch,
  BranchCreate,
  BranchUpdate,
  Invitation,
  InvitationCreate,
  InvitationCreated,
  Me,
  Member,
  MemberUpdate,
  Org,
  OrgCreate,
  OrgSettingsUpdate,
} from './types'

export function useMeQuery(enabled = true) {
  const api = useApi()
  return useQuery({
    queryKey: qk.me,
    queryFn: ({ signal }) => api.get<Me>('/me', { orgScoped: false, signal }),
    enabled,
  })
}

export function useCreateOrg() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: OrgCreate) => api.post<Org>('/orgs', body, { orgScoped: false }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useAcceptInvitation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      api.post<{ org_id: string }>('/invitations/accept', { token }, { orgScoped: false }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useOrgQuery() {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.org(orgId),
    queryFn: ({ signal }) => api.get<Org>('/org', { orgId, signal }),
  })
}

export function useUpdateOrgSettings() {
  const api = useApi()
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: (body: OrgSettingsUpdate) => api.patch<Org>('/org/settings', body, { orgId }),
    onSuccess: (org) => {
      qc.setQueryData(qk.org(orgId), org)
      void qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useMembersQuery() {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.members(orgId),
    queryFn: ({ signal }) => api.get<Member[]>('/members', { orgId, signal }),
  })
}

export function useUpdateMember() {
  const api = useApi()
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MemberUpdate }) =>
      api.patch<Member>(`/members/${id}`, body, { orgId }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.members(orgId) }),
        qc.invalidateQueries({ queryKey: qk.me }),
      ])
    },
  })
}

export function useRemoveMember() {
  const api = useApi()
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/members/${id}`, { orgId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.members(orgId) })
    },
  })
}

export function useInvitationsQuery(enabled: boolean) {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.invitations(orgId),
    queryFn: ({ signal }) => api.get<Invitation[]>('/invitations', { orgId, signal }),
    enabled,
  })
}

export function useCreateInvitation() {
  const api = useApi()
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: (body: InvitationCreate) => api.post<InvitationCreated>('/invitations', body, { orgId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.invitations(orgId) })
    },
  })
}

export function useRevokeInvitation() {
  const api = useApi()
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/invitations/${id}`, { orgId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.invitations(orgId) })
    },
  })
}

export function useBranchesQuery() {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.branches(orgId),
    queryFn: ({ signal }) => api.get<Branch[]>('/branches', { orgId, signal }),
  })
}

export function useCreateBranch() {
  const api = useApi()
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: (body: BranchCreate) => api.post<Branch>('/branches', body, { orgId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.branches(orgId) })
    },
  })
}

export function useUpdateBranch() {
  const api = useApi()
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BranchUpdate }) =>
      api.patch<Branch>(`/branches/${id}`, body, { orgId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.branches(orgId) })
    },
  })
}
