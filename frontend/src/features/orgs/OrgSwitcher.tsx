import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown'
import { t } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { useOrg } from './org-context'

export function OrgSwitcher({ compact = false }: { compact?: boolean }) {
  const { me, membership, switchOrg } = useOrg()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownTrigger
        aria-label={t('nav.switchOrg')}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface p-1.5 text-start shadow-xs transition-colors hover:bg-subtle data-[state=open]:bg-subtle',
          compact && 'justify-center border-transparent bg-transparent shadow-none',
        )}
      >
        <Avatar name={membership.org_name} seed={membership.org_id} className="size-7 rounded-md" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-tight font-medium">{membership.org_name}</span>
              <span className="block text-xs leading-tight text-muted">
                {t(`roles.${membership.role}`)}
                {membership.is_demo && ` (${t('nav.demo')})`}
              </span>
            </span>
            <ChevronsUpDown aria-hidden className="me-1 size-3.5 shrink-0 text-muted" />
          </>
        )}
      </DropdownTrigger>
      <DropdownContent align="start" className="w-64">
        <DropdownLabel>{t('nav.switchOrg')}</DropdownLabel>
        {me.memberships.map((m) => (
          <DropdownItem
            key={m.org_id}
            onSelect={() => {
              if (m.org_id !== membership.org_id) {
                switchOrg(m.org_id)
                navigate('/')
              }
            }}
          >
            <Avatar name={m.org_name} seed={m.org_id} className="size-6 rounded-md text-2xs" />
            <span className="min-w-0 flex-1 truncate">{m.org_name}</span>
            {m.is_demo && <Badge tone="warning">{t('nav.demo')}</Badge>}
            {m.org_id === membership.org_id && <Check aria-label={t('common.current')} className="!text-accent-text" />}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem onSelect={() => navigate('/onboarding')}>
          <Plus aria-hidden />
          {t('nav.newOrg')}
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  )
}
