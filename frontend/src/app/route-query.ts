import { t } from '@/lib/strings'
import type { Command } from './CommandPalette'

/** Free text that matches no command is a question: the Ask row leads the list. */
export function routeQuery(query: string, commands: Command[]): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  const hits = commands.filter((c) => !c.ask && `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase().includes(q))
  const ask: Command = { ...commands.find((c) => c.ask)!, label: t('palette.ask', { text: query.trim() }) }
  // A question (several words or a question mark) leads; a page name match leads otherwise.
  const looksLikeQuestion = /\?|\s/.test(query.trim()) || hits.length === 0
  return looksLikeQuestion ? [ask, ...hits] : [...hits, ask]
}

