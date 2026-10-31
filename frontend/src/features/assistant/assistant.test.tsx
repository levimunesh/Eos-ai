import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithOrg } from '@/test/utils'
import { AnswerPanel } from './AnswerPanel'
import { applyEvent, createSseParser, EMPTY_ANSWER } from './sse'
import type { AssistantEvent } from './types'

const ev = (type: string, data: Record<string, unknown>) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`

/** A realistic stream: one lookup, text in pieces, then the verifier's verdict. */
const FIXTURE =
  ev('start', { user_message_id: 'u1' }) +
  ev('tool_call', { seq: 1, name: 'get_kpis', args: { from: '2025-03-01', to: '2025-03-31' } }) +
  ev('tool_result', { seq: 1, name: 'get_kpis', is_error: false, summary: '3 KPIs for 2025-03-01 to 2025-03-31' }) +
  ev('tool_call', { seq: 2, name: 'get_insights', args: { from: '2025-03-01', to: '2025-03-31' } }) +
  ev('tool_result', { seq: 2, name: 'get_insights', is_error: false, summary: '2 insights' }) +
  ev('text', { text: 'Net sales were OMR 40,289.545, ' }) +
  ev('text', { text: 'up 13.4% on February.' })

const DONE = (verified: boolean, unverified: string[]) =>
  ev('done', { message_id: 'm1', verified, unverified_numbers: unverified, tool_calls: [{ seq: 1, name: 'get_kpis', args: {}, is_error: false }], usage: { input_tokens: 1, output_tokens: 1, rounds: 1, latency_ms: 10 } })

function streamResponse(body: string, chunk = 17): Response {
  const bytes = new TextEncoder().encode(body)
  let i = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= bytes.length) return controller.close()
      controller.enqueue(bytes.slice(i, i + chunk))
      i += chunk
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('SSE parsing', () => {
  it('reassembles events split across chunks and folds them into an answer', () => {
    const parser = createSseParser()
    const body = FIXTURE + DONE(true, [])
    const events: AssistantEvent[] = []
    for (let i = 0; i < body.length; i += 7) events.push(...parser.push(body.slice(i, i + 7)))
    events.push(...parser.end())
    expect(events.map((e) => e.type)).toEqual(['start', 'tool_call', 'tool_result', 'tool_call', 'tool_result', 'text', 'text', 'done'])
    const answer = events.reduce(applyEvent, EMPTY_ANSWER)
    expect(answer.text).toBe('Net sales were OMR 40,289.545, up 13.4% on February.')
    expect(answer.lookups.map((l) => [l.name, l.summary])).toEqual([
      ['get_kpis', '3 KPIs for 2025-03-01 to 2025-03-31'],
      ['get_insights', '2 insights'],
    ])
    expect(answer).toMatchObject({ state: 'done', verified: true, unverified: [] })
  })

  it('keeps a mid-stream state while lookups are running and records errors', () => {
    const parser = createSseParser()
    const partial = parser.push(ev('tool_call', { seq: 1, name: 'get_kpis', args: {} }) + 'event: text\ndata: {"type":"text","te')
    const a = partial.reduce(applyEvent, EMPTY_ANSWER)
    expect(a.lookups[0].summary).toBeNull()
    expect(a.state).toBe('streaming')
    const b = applyEvent(a, { type: 'error', message_id: 'm', message: 'nope' })
    expect(b).toMatchObject({ state: 'error', error: 'nope' })
  })
})

describe('answer panel', () => {
  const routes = (tail: string) => ({
    'GET /assistant/status': { configured: true, model: 'claude-sonnet-4-5' },
    'GET /assistant/conversations': [],
    'POST /assistant/conversations': { id: 'c9', title: 'New conversation', created_at: '2026-10-30T00:00:00Z', updated_at: '2026-10-30T00:00:00Z' },
    'GET /assistant/conversations/c9': { id: 'c9', title: 'New conversation', created_at: '2026-10-30T00:00:00Z', messages: [] },
    'POST /assistant/conversations/c9/messages': () => streamResponse(FIXTURE + tail),
  })

  it('streams text, shows the lookups and marks the answer as checked', async () => {
    const user = userEvent.setup()
    renderWithOrg(<AnswerPanel open onOpenChange={() => undefined} />, { role: 'owner', routes: routes(DONE(true, [])) })
    const box = await screen.findByLabelText('Ask about sales, margins or branches…')
    await user.type(box, 'What were net sales in March?{Enter}')
    const dialog = screen.getByRole('dialog')
    // Figures render as mono chips, so match on the paragraph's whole text.
    await waitFor(() => expect(within(dialog).getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Net sales were OMR 40,289.545, up 13.4% on February.')).toBeInTheDocument())
    const lookups = within(dialog).getByRole('list', { name: 'Looking up' })
    expect(lookups).toHaveTextContent('Key figures: 3 KPIs for 2025-03-01 to 2025-03-31')
    expect(lookups).toHaveTextContent('Finding what changed: 2 insights')
    await waitFor(() => expect(within(dialog).getByTestId('verdict')).toHaveAttribute('data-verified', 'true'))
    expect(within(dialog).getByText('Every figure checked against your records')).toBeInTheDocument()
    expect(within(dialog).getByText('Sources · 2 lookups', { exact: false })).toBeInTheDocument()
  })

  it('lists the figures the verifier could not check', async () => {
    const user = userEvent.setup()
    renderWithOrg(<AnswerPanel open onOpenChange={() => undefined} />, { role: 'owner', routes: routes(DONE(false, ['13.4%'])) })
    await user.type(await screen.findByLabelText('Ask about sales, margins or branches…'), 'March?{Enter}')
    const verdict = await screen.findByTestId('verdict')
    expect(verdict).toHaveAttribute('data-verified', 'false')
    expect(verdict).toHaveTextContent('1 figure could not be checked against your records')
    expect(verdict).toHaveTextContent('13.4%')
  })

  it('sends a question handed in from the palette and shows a calm state when AI is off', async () => {
    const { unmount } = renderWithOrg(<AnswerPanel open onOpenChange={() => undefined} question="Why?" questionKey={1} />, { role: 'owner', routes: routes(DONE(true, [])) })
    expect(await screen.findByText('Why?')).toBeInTheDocument()
    await screen.findByTestId('verdict')
    unmount()
    renderWithOrg(<AnswerPanel open onOpenChange={() => undefined} />, { role: 'owner', routes: { 'GET /assistant/status': { configured: false, model: 'x' } } })
    expect(await screen.findByText('AI is not set up yet')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ask about sales, margins or branches…')).not.toBeInTheDocument()
  })
})
