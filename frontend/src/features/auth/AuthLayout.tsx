import type { ReactNode } from 'react'
import { Wordmark } from '@/app/Wordmark'
import { t } from '@/lib/strings'
import { BrandArt } from './BrandArt'

export function AuthLayout({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:grid lg:h-dvh lg:min-h-[40rem] lg:grid-cols-2">
      <main className="flex flex-1 flex-col px-5 py-5 sm:px-10 sm:py-6 lg:overflow-y-auto">
        <div aria-hidden className="relative -mx-1 mb-2 h-32 overflow-hidden rounded-lg bg-[#ece3ee] sm:h-40 lg:hidden">
          <BrandArt anchor="horizon" />
          <Wordmark className="absolute start-4 top-3 text-[#15121c]" />
        </div>
        <Wordmark className="hidden lg:inline-flex" />
        <div className="flex flex-1 items-start justify-center py-8 lg:items-center lg:py-10">
          <div className="w-full max-w-[22rem]">
            <h1 className="mb-6 text-h1">{title}</h1>
            {children}
            {footer && <div className="mt-6 text-body text-muted">{footer}</div>}
          </div>
        </div>
      </main>
      {/* Full-height card on the end half, inset 16px; a solid fallback colour sits under the art. */}
      <aside
        data-testid="brand-panel"
        className="relative m-4 hidden overflow-hidden rounded-xl bg-[#ece3ee] ring-1 ring-black/5 lg:ms-0 lg:block dark:ring-white/10"
      >
        <BrandArt />
        <div className="relative flex h-full flex-col justify-end p-10 text-white xl:p-12">
          <p className="max-w-[18ch] text-[1.75rem] leading-[1.15] font-semibold tracking-tight">{t('auth.brandHeadline')}</p>
          <p className="mt-2 max-w-[42ch] text-body text-white/80">{t('auth.brandBody')}</p>
        </div>
      </aside>
    </div>
  )
}
