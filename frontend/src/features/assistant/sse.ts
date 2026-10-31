import type { Answer, AssistantEvent, Lookup } from './types'

/**
 * Incremental server-sent-events parser. Feed it text chunks; it returns the complete events
 * found so far and keeps any partial trailing event for the next chunk.
 */
export function createSseParser() {
  let buffer = ''
  return {
    push(chunk: string): AssistantEvent[] {
      buffer += chunk.replace(/\r\n/g, '\n')
      const out: AssistantEvent[] = []
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const ev = parseBlock(block)
        if (ev) out.push(ev)
      }
      return out
    },
    /** Flushes a final event that arrived without a trailing blank line. */
    end(): AssistantEvent[] {
      const ev = buffer.trim() ? parseBlock(buffer) : null
      buffer = ''
      return ev ? [ev] : []
    },
  }
}

function parseBlock(block: string): AssistantEvent | null {
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (!data.length) return null
  try {
    const parsed = JSON.parse(data.join('\n')) as AssistantEvent
    return parsed && typeof parsed === 'object' && 'type' in parsed ? parsed : null
  } catch {
    return null
  }
}

export const EMPTY_ANSWER: Answer = { text: '', lookups: [], state: 'streaming', verified: null, unverified: [], error: null }

/** Folds one event into the answer being built. Pure, so the panel and tests share it. */
export function applyEvent(a: Answer, ev: AssistantEvent): Answer {
  switch (ev.type) {
    case 'start':
      return a
    case 'text':
      return { ...a, text: a.text + ev.text }
    case 'tool_call': {
      const l: Lookup = { seq: ev.seq, name: ev.name, args: ev.args, summary: null, is_error: false }
      return { ...a, lookups: [...a.lookups.filter((x) => x.seq !== ev.seq), l] }
    }
    case 'tool_result':
      return {
        ...a,
        lookups: a.lookups.map((l) => (l.seq === ev.seq ? { ...l, summary: ev.summary, is_error: ev.is_error } : l)),
      }
    case 'done':
      return { ...a, state: 'done', verified: ev.verified, unverified: ev.unverified_numbers, text: a.text.trim() }
    case 'error':
      return { ...a, state: 'error', error: ev.message, text: a.text.trim() }
  }
}

/** Reads a streaming Response body and applies each event. Resolves when the stream closes. */
export async function readAnswerStream(res: Response, onAnswer: (a: Answer) => void, signal?: AbortSignal): Promise<Answer> {
  let answer = EMPTY_ANSWER
  const parser = createSseParser()
  const apply = (evs: AssistantEvent[]) => {
    for (const ev of evs) {
      answer = applyEvent(answer, ev)
      onAnswer(answer)
    }
  }
  if (!res.body) {
    apply(parser.push(await res.text()))
    apply(parser.end())
    return answer
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel()
      break
    }
    const { value, done } = await reader.read()
    if (done) break
    apply(parser.push(decoder.decode(value, { stream: true })))
  }
  apply(parser.push(decoder.decode()))
  apply(parser.end())
  return answer
}
