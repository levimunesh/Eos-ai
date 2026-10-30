import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useOrg } from './org-context'

export function OrgSwitcher() {
  const { me, membership, switchOrg } = useOrg()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.switchOrg')}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-start hover:bg-white/10"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{membership.org_name}</span>
          <span className="block text-xs text-white/60">
            {t(`roles.${membership.role}`)}
            {membership.is_demo && ` (${t('nav.demo')})`}
          </span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-white/60" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-line bg-surface py-1 text-ink shadow-[0_8px_24px_-8px_rgb(13_46_49/0.35)]"
        >
          {me.memberships.map((m) => (
            <button
              key={m.org_id}
              role="menuitemradio"
              aria-checked={m.org_id === membership.org_id}
              type="button"
              onClick={() => {
                setOpen(false)
                if (m.org_id !== membership.org_id) {
                  switchOrg(m.org_id)
                  navigate('/')
                }
              }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-sunken')}
            >
              <Check
                aria-hidden
                className={cn('size-4 shrink-0 text-petrol', m.org_id === membership.org_id ? 'opacity-100' : 'opacity-0')}
              />
              <span className="min-w-0 flex-1 truncate">{m.org_name}</span>
              {m.is_demo && <Badge tone="amber">{t('nav.demo')}</Badge>}
              <span className="text-xs text-muted">{t(`roles.${m.role}`)}</span>
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <Link
            role="menuitem"
            to="/onboarding"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-petrol-500 hover:bg-sunken"
          >
            <Plus aria-hidden className="size-4" />
            {t('nav.newOrg')}
          </Link>
        </div>
      )}
    </div>
  )
}
