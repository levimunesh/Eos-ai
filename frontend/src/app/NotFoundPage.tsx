import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button'
import { t } from '@/lib/strings'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="text-2xl font-semibold">{t('errors.notFoundTitle')}</h1>
      <p className="text-sm text-muted">{t('errors.notFoundBody')}</p>
      <Link to="/" className={buttonVariants({ variant: 'secondary' })}>
        {t('errors.goHome')}
      </Link>
    </div>
  )
}
