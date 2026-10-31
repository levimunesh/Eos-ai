import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useShell } from '@/app/shell-context'
import { AiMark } from '@/app/Wordmark'
import { Figures } from '@/features/assistant/AnswerPanel'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import type { Insight } from './types'

/**
 * The AI insight strip: a hairline card with a dawn rule, at most two computed sentences, numbers
 * as mono chips, a ✓ "checked against N records" affordance and an "Ask" that opens the palette
 * prefilled. Never animated on load; dismissable per insight.
 */
export function InsightStrip({ insights, rowCount, fallback }: { insights: Insight[]; rowCount: number | null; fallback: boolean }) {
  const { openPalette } = useShell()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const order = (i: Insight) => (i.kind === 'headline_change' ? 0 : 1)
  const visible = insights.filter((i) => !dismissed.has(i.text)).sort((a, b) => order(a) - order(b)).slice(0, 2)
  if (visible.length === 0) return null
  const question = `Why: ${visible[0].text.split('. ')[0]}?`
  return (
    <section aria-label={t('dashboard.insightTitle')} className="dawn-hairline dawn-rule flex flex-col gap-2 rounded-lg px-4 py-3 ps-5">
      <div className="flex items-start gap-3">
        <AiMark className="mt-1 size-4" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {visible.map((i) => (
            <p key={i.text} className={cn('flex items-start gap-2 text-body leading-5 text-fg')}>
              <span className="min-w-0 flex-1">
                <Figures text={i.text} />
              </span>
              <button type="button" aria-label={t('dashboard.insightDismiss')} onClick={() => setDismissed((d) => new Set(d).add(i.text))} className="-me-1 flex size-5 shrink-0 items-center justify-center rounded-sm text-muted opacity-60 hover:bg-surface-2 hover:opacity-100">
                <X className="size-3" />
              </button>
            </p>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ps-7 text-caption text-muted">
        <span className="inline-flex items-center gap-1">
          <Check aria-hidden className="size-3 text-success" strokeWidth={2.5} />
          {fallback ? t('dashboard.insightFallback') : rowCount !== null ? t('dashboard.insightChecked', { n: rowCount.toLocaleString('en') }) : t('dashboard.insightFallback')}
        </span>
        <button type="button" onClick={() => openPalette(question)} className="inline-flex items-center gap-1 font-medium text-dawn-ink hover:underline">
          {t('dashboard.insightAsk')} <span aria-hidden>→</span>
        </button>
      </div>
    </section>
  )
}
