export interface AssistantStatus {
  configured: boolean
  model: string
}

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ToolCallSummary {
  seq: number
  name: string
  args: Record<string, unknown>
  is_error: boolean
  /** Only present on stored tool calls. */
  result?: unknown
  duration_ms?: number
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  verified: boolean | null
  unverified_numbers: string[]
  error: string | null
  created_at: string
  tool_calls: ToolCallSummary[]
}

export interface ConversationDetail {
  id: string
  title: string
  created_at: string
  messages: StoredMessage[]
}

/** Server-sent events from POST /assistant/conversations/{id}/messages. */
export type AssistantEvent =
  | { type: 'start'; user_message_id: string }
  | { type: 'text'; text: string }
  | { type: 'tool_call'; seq: number; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; seq: number; name: string; is_error: boolean; summary: string }
  | {
      type: 'done'
      message_id: string
      verified: boolean
      unverified_numbers: string[]
      tool_calls: ToolCallSummary[]
      usage: { input_tokens: number; output_tokens: number; rounds: number; latency_ms: number }
    }
  | { type: 'error'; message_id: string; message: string }

/** One lookup the assistant made, shown as a progress row. */
export interface Lookup {
  seq: number
  name: string
  args: Record<string, unknown>
  summary: string | null
  is_error: boolean
}

/** What the panel renders for one assistant turn, live or stored. */
export interface Answer {
  text: string
  lookups: Lookup[]
  state: 'streaming' | 'done' | 'error'
  verified: boolean | null
  unverified: string[]
  error: string | null
}
