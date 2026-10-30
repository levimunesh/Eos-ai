import type { ReactNode } from 'react'
import { Wordmark } from '@/app/Wordmark'
import { t } from '@/lib/strings'

export function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper md:grid md:grid-cols-[minmax(18rem,26rem)_1fr]">
      <aside className="flex items-center justify-between bg-petrol px-5 py-4 text-white md:flex-col md:items-start md:justify-between md:px-10 md:py-10">
        <Wordmark />
        <p className="hidden max-w-[28ch] font-display text-2xl leading-snug font-medium text-white/85 md:block">
          {t('app.tagline')}
        </p>
      </aside>
      <main className="flex flex-1 items-start justify-center px-4 py-10 md:items-center md:px-10">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
          {children}
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
