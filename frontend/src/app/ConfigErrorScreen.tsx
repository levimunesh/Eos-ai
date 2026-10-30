import { TriangleAlert } from 'lucide-react'
import { t } from '@/lib/strings'

export function ConfigErrorScreen({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div role="alert" className="w-full max-w-lg rounded-lg border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-amber" />
          <div className="flex flex-col gap-3">
            <h1 className="text-lg font-semibold">{t('config.title')}</h1>
            <p className="text-sm text-ink-2">{t('config.body')}</p>
            <ul className="flex flex-col gap-1">
              {missing.map((name) => (
                <li key={name}>
                  <code className="rounded-sm bg-sunken px-1.5 py-0.5 text-sm">{name}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
