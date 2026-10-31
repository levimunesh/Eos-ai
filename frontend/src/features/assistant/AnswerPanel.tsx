import { ArrowUp, Check, ChevronLeft, CircleAlert, Loader2, Plus, Square, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AiMark } from '@/app/Wordmark'
import { Sheet } from '@/components/ui/sheet'
import { relativeTime } from '@/features/imports/format'
import { en, t, type StringKey } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useAsk, useAssistantStatus, useConversation, useConversations } from './api'
import { EMPTY_ANSWER } from './sse'
import type { Answer, Lookup, StoredMessage } from './types'

/** Numbers in prose become mono chips so they read as figures, not words. */
export function Figures({ text }: { text: string }) {
  const parts = text.split(/((?<![\w-])(?:[A-Z]{3} )?[-+]?\d[\d,]*(?:\.\d+)?%?(?![\w-]))/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={i} className="mono rounded-[4px] bg-surface-2 px-1 py-px text-fg">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function toolLabel(name: string) {
  const key = `assistant.tools.${name}` as StringKey
  const label = t(key)
  return label === key ? name : label
}

function argsSummary(args: Record<string, unknown>) {
  const from = args.from ?? args.start
  const to = args.to ?? args.end
  const bits: string[] = []
  if (typeof from === 'string' && typeof to === 'string') bits.push(`${from} to ${to}`)
  if (typeof args.dimension === 'string') bits.push(`by ${args.dimension}`)
  return bits.join(', ')
}

function Lookups({ lookups, live }: { lookups: Lookup[]; live: boolean }) {
  if (!lookups.length) return null
  return (
    <ul aria-label={t('assistant.lookingUp')} className="flex flex-col gap-1 text-caption text-muted">
      {lookups.map((l) => (
        <li key={l.seq} className="flex items-start gap-2">
          {l.summary === null && live ? (
            <Loader2 aria-hidden className="mt-0.5 size-3 shrink-0 animate-spin motion-reduce:animate-none" />
          ) : l.is_error ? (
            <CircleAlert aria-hidden className="mt-0.5 size-3 shrink-0 text-danger-text" />
          ) : (
            <Check aria-hidden className="mt-0.5 size-3 shrink-0 text-success" />
          )}
          <span>
            <span className="text-fg-2">{toolLabel(l.name)}</span>
            {l.summary ? `: ${l.summary}` : argsSummary(l.args) ? ` · ${argsSummary(l.args)}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Verdict({ answer }: { answer: Answer }) {
  if (answer.state === 'error') {
    return (
      <p role="alert" className="flex items-start gap-1.5 text-caption text-danger-text">
        <CircleAlert aria-hidden className="mt-0.5 size-3 shrink-0" />
        {answer.error ?? t('assistant.failed')}
      </p>
    )
  }
  if (answer.state !== 'done') return null
  if (answer.verified) {
    return (
      <p data-testid="verdict" data-verified="true" className="flex items-center gap-1.5 text-caption text-success">
        <Check aria-hidden className="size-3" strokeWidth={2.5} />
        {t('assistant.verified')}
      </p>
    )
  }
  const n = answer.unverified.length
  return (
    <div data-testid="verdict" data-verified="false" className="flex flex-col gap-1 text-caption text-warning">
      <p className="flex items-center gap-1.5">
        <TriangleAlert aria-hidden className="size-3" />
        {n === 1 ? t('assistant.unverifiedOne') : t('assistant.unverified', { n })}
      </p>
      {n > 0 && (
        <p className="flex flex-wrap gap-1">
          {answer.unverified.map((u, i) => (
            <span key={`${u}-${i}`} className="mono rounded-[4px] bg-warning-soft px-1">
              {u}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

function Sources({ lookups }: { lookups: Lookup[] }) {
  if (!lookups.length) return null
  return (
    <details className="group text-caption">
      <summary className="cursor-pointer list-none text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        {t('assistant.sources')} · {lookups.length === 1 ? t('assistant.lookupOne') : t('assistant.lookups', { n: lookups.length })}
      </summary>
      <ol className="mt-1.5 flex flex-col gap-1 border-s border-line ps-3">
        {lookups.map((l) => (
          <li key={l.seq} className="flex flex-col">
            <span className="mono text-fg-2">{l.name}</span>
            <span className="mono break-all text-muted">{JSON.stringify(l.args)}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}

function AssistantTurn({ answer, live }: { answer: Answer; live: boolean }) {
  return (
    <div className="dawn-rule flex flex-col gap-2.5 ps-4">
      <div className="flex items-center gap-1.5 text-caption text-muted">
        <AiMark className="size-3.5 rounded-[4px]" />
        {t('app.name')}
      </div>
      <Lookups lookups={answer.lookups} live={live} />
      {answer.text ? (
        <p className="whitespace-pre-wrap text-body text-fg">
          <Figures text={answer.text} />
          {live && answer.state === 'streaming' && <span aria-hidden className="anim-caret ms-px inline-block h-3.5 w-px translate-y-0.5 bg-fg" />}
        </p>
      ) : live && answer.state === 'streaming' && !answer.lookups.length ? (
        <p className="text-body text-muted">{t('assistant.thinking')}</p>
      ) : null}
      <Verdict answer={answer} />
      {answer.state === 'done' && <Sources lookups={answer.lookups} />}
    </div>
  )
}

function UserTurn({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-muted">{t('assistant.you')}</span>
      <p className="text-body font-medium text-fg">{text}</p>
    </div>
  )
}

function fromStored(m: StoredMessage): Answer {
  return {
    text: m.content,
    lookups: m.tool_calls.map((c) => ({ seq: c.seq, name: c.name, args: c.args, summary: null, is_error: c.is_error })),
    state: m.error ? 'error' : 'done',
    verified: m.verified,
    unverified: m.unverified_numbers,
    error: m.error ? t('assistant.failed') : null,
  }
}

interface Turn {
  id: string
  question: string
  answer: Answer
  createdAt: number
}

function NotConfigured() {
  return (
    <div className="flex max-w-[60ch] flex-col items-start gap-2 px-5 py-6">
      <AiMark className="size-5 rounded-md opacity-70" />
      <h3 className="text-[0.9375rem] font-semibold">{t('assistant.notConfiguredTitle')}</h3>
      <p className="text-body text-muted">{t('assistant.notConfiguredBody')}</p>
    </div>
  )
}

export function AnswerPanel({
  open,
  onOpenChange,
  question,
  questionKey,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A question to send as soon as the panel opens (from the palette or an insight). */
  question?: string | null
  /** Changes whenever a new question is handed in, even if the text repeats. */
  questionKey?: number
}) {
  const status = useAssistantStatus(open)
  const configured = status.data?.configured ?? false
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [liveTurns, setLiveTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const conversations = useConversations(open && configured)
  const stored = useConversation(view === 'chat' ? conversationId : null)
  const ask = useAsk()
  const abort = useRef<AbortController | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [now] = useState(() => Date.now())

  // Stored turns come from the server; live turns are the ones streaming now. Once a live turn has
  // been stored (the conversation refetches after each answer), the stored copy replaces it.
  const storedTurns = useMemo<Turn[]>(() => {
    const msgs = stored.data?.messages ?? []
    const out: Turn[] = []
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]
      if (m.role !== 'user') continue
      const a = msgs[i + 1]?.role === 'assistant' ? msgs[i + 1] : null
      out.push({ id: m.id, question: m.content, answer: a ? fromStored(a) : { ...EMPTY_ANSWER, state: 'error', error: t('assistant.stopped') }, createdAt: 0 })
    }
    return out
  }, [stored.data])
  const turns = useMemo(
    () => [
      ...storedTurns,
      ...liveTurns.filter((x) => !(x.createdAt < (stored.dataUpdatedAt || 0) && storedTurns.some((st) => st.question === x.question))),
    ],
    [storedTurns, liveTurns, stored.dataUpdatedAt],
  )

  const send = useCallback(
    (text: string) => {
      const q = text.trim()
      if (!q || ask.isPending) return
      const createdAt = Date.now()
      const id = `live-${createdAt}`
      setLiveTurns((ts) => [...ts, { id, question: q, answer: EMPTY_ANSWER, createdAt }])
      setDraft('')
      setView('chat')
      const ctrl = new AbortController()
      abort.current = ctrl
      ask.mutate(
        {
          conversationId,
          question: q,
          signal: ctrl.signal,
          onAnswer: (a) => setLiveTurns((ts) => ts.map((x) => (x.id === id ? { ...x, answer: a } : x))),
        },
        {
          onSuccess: (r) => setConversationId(r.conversationId),
          onError: (e) => {
            const stopped = e instanceof DOMException && e.name === 'AbortError'
            setLiveTurns((ts) =>
              ts.map((x) => (x.id === id ? { ...x, answer: { ...x.answer, state: 'error', error: stopped ? t('assistant.stopped') : null } } : x)),
            )
          },
        },
      )
    },
    [ask, conversationId],
  )

  // A question handed in from outside is sent once the panel knows the assistant is configured.
  const sentKey = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!open || !question || !configured || sentKey.current === questionKey) return
    sentKey.current = questionKey
    send(question)
  }, [open, question, questionKey, configured, send])

  useEffect(() => {
    const el = scroller.current?.parentElement
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight })
  }, [turns])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(draft)
  }

  const startNew = () => {
    abort.current?.abort()
    setConversationId(null)
    setLiveTurns([])
    setView('chat')
  }

  let body: ReactNode
  if (status.isPending) body = <p className="px-5 py-6 text-body text-muted">{t('common.loading')}</p>
  else if (!configured) body = <NotConfigured />
  else if (view === 'history') {
    const list = conversations.data ?? []
    body = (
      <div className="flex flex-col px-3 py-2">
        {list.length === 0 ? (
          <p className="px-2 py-4 text-body text-muted">{t('assistant.noHistory')}</p>
        ) : (
          <ul className="flex flex-col">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setConversationId(c.id)
                    setLiveTurns([])
                    setView('chat')
                  }}
                  className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-start hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate text-body text-fg">{c.title}</span>
                  <span className="mono shrink-0 text-muted">{relativeTime(c.updated_at, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  } else if (turns.length === 0) {
    body = (
      <div className="flex flex-col gap-3 px-5 py-5">
        <p className="text-body text-muted">{t('overview.assistantBody')}</p>
        <ul className="flex flex-col gap-1">
          {en.assistant.examples.map((ex) => (
            <li key={ex}>
              <button type="button" onClick={() => send(ex)} className="w-full rounded-md border border-line px-3 py-2 text-start text-body text-fg-2 hover:border-line-strong hover:text-fg">
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  } else {
    body = (
      <ol className="flex flex-col gap-6 px-5 py-4" aria-live="polite">
        {turns.map((turn, i) => (
          <li key={turn.id} className="flex flex-col gap-3">
            <UserTurn text={turn.question} />
            <AssistantTurn answer={turn.answer} live={i === turns.length - 1 && ask.isPending} />
          </li>
        ))}
      </ol>
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
      title={
        <span className="inline-flex items-center gap-2">
          <AiMark className="size-5 rounded-md" />
          {t('assistant.title')}
        </span>
      }
      header={
        configured && (
          <div className="mt-2 flex items-center gap-1 text-caption">
            {view === 'history' ? (
              <button type="button" onClick={() => setView('chat')} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-fg-2 hover:bg-surface-2">
                <ChevronLeft aria-hidden className="size-3 rtl:-scale-x-100" />
                {t('common.back')}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setView('history')} className="inline-flex h-6 items-center rounded-md px-1.5 text-fg-2 hover:bg-surface-2">
                  {t('assistant.history')}
                </button>
                <button type="button" onClick={startNew} className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-fg-2 hover:bg-surface-2">
                  <Plus aria-hidden className="size-3" />
                  {t('assistant.newQuestion')}
                </button>
              </>
            )}
            {status.data?.model && <span className="mono ms-auto text-muted">{status.data.model}</span>}
          </div>
        )
      }
      footer={
        configured && view === 'chat' ? (
          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line px-4 py-3">
            <textarea
              aria-label={t('assistant.placeholder')}
              placeholder={t('assistant.placeholder')}
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(draft)
                }
              }}
              className="focus-field max-h-32 min-h-9 flex-1 resize-none rounded-md border border-line-strong bg-surface px-3 py-2 text-body text-fg placeholder:text-muted"
            />
            {ask.isPending ? (
              <button type="button" onClick={() => abort.current?.abort()} aria-label={t('assistant.stop')} className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong text-fg-2 hover:bg-surface-2">
                <Square className="size-3.5" />
              </button>
            ) : (
              <button type="submit" aria-label={t('assistant.send')} disabled={!draft.trim()} className={cn('btn-primary flex size-9 shrink-0 items-center justify-center rounded-md text-accent-fg disabled:opacity-50')}>
                <ArrowUp className="size-4" />
              </button>
            )}
          </form>
        ) : undefined
      }
    >
      <div ref={scroller}>{body}</div>
    </Sheet>
  )
}
