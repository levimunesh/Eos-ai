import { TriangleAlert } from 'lucide-react'
import { t } from '@/lib/strings'

export function ConfigErrorScreen({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div role="alert" className="surface-raised w-full max-w-lg rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <TriangleAlert aria-hidden className="size-4" />
          </span>
          <div className="flex flex-col gap-3">
            <h1 className="text-base font-semibold">{t('config.title')}</h1>
            <p className="text-body text-fg-2">{t('config.body')}</p>
            <ul className="flex flex-col gap-1">
              {missing.map((name) => (
                <li key={name}>
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.8125rem] ring-1 ring-line ring-inset">{name}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
