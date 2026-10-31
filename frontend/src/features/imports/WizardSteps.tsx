import { Check } from 'lucide-react'
import { t, type StringKey } from '@/lib/strings'
import { cn } from '@/lib/utils'

const STEPS: StringKey[] = ['imports.wizard.steps.file', 'imports.wizard.steps.map', 'imports.wizard.steps.review']

export function WizardSteps({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="mono text-muted">{t('common.stepOf', { step: step + 1, total: STEPS.length })}</p>
      <ol aria-label={t('onboarding.progress')} className="grid grid-cols-3 gap-2">
        {STEPS.map((key, i) => (
          <li key={key} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-1.5">
            <span aria-hidden className={cn('h-0.5 rounded-full transition-colors duration-300', i <= step ? 'bg-fg' : 'bg-line')} />
            <span className={cn('flex items-center gap-1.5 text-caption', i === step ? 'font-medium text-fg' : 'text-muted')}>
              {i < step && <Check aria-hidden className="size-3 text-success" strokeWidth={3} />}
              <span className="truncate">{t(key)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
