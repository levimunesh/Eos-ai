import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrg } from '@/features/orgs/org-context'
import { useApi } from '@/lib/api-context'
import { qk } from '@/lib/query-keys'
import { readAnswerStream } from './sse'
import type { Answer, AssistantStatus, ConversationDetail, ConversationSummary } from './types'

export function useAssistantStatus(enabled = true) {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.assistantStatus(orgId),
    queryFn: ({ signal }) => api.get<AssistantStatus>('/assistant/status', { orgId, signal }),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useConversations(enabled = true) {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.conversations(orgId),
    queryFn: ({ signal }) => api.get<ConversationSummary[]>('/assistant/conversations', { orgId, signal }),
    enabled,
  })
}

export function useConversation(id: string | null) {
  const api = useApi()
  const { orgId } = useOrg()
  return useQuery({
    queryKey: qk.conversation(orgId, id ?? ''),
    queryFn: ({ signal }) => api.get<ConversationDetail>(`/assistant/conversations/${id}`, { orgId, signal }),
    enabled: !!id,
  })
}

/** Creates a conversation when needed, then streams the answer, reporting progress as it arrives. */
export function useAsk() {
  const api = useApi()
  const qc = useQueryClient()
  const { orgId } = useOrg()
  return useMutation({
    mutationFn: async ({
      conversationId,
      question,
      onAnswer,
      signal,
    }: {
      conversationId: string | null
      question: string
      onAnswer: (a: Answer) => void
      signal?: AbortSignal
    }) => {
      let id = conversationId
      if (!id) {
        const conv = await api.post<ConversationSummary>('/assistant/conversations', {}, { orgId, signal })
        id = conv.id
      }
      const res = await api.stream(`/assistant/conversations/${id}/messages`, { content: question }, { orgId, signal })
      const answer = await readAnswerStream(res, onAnswer, signal)
      return { conversationId: id, answer }
    },
    onSettled: (data) => {
      void qc.invalidateQueries({ queryKey: qk.conversations(orgId) })
      if (data) void qc.invalidateQueries({ queryKey: qk.conversation(orgId, data.conversationId) })
    },
  })
}
