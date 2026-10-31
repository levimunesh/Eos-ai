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
          'flex h-9 w-full items-center gap-2 rounded-md px-2 text-start transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2',
          compact && 'justify-center px-0',
        )}
      >
        <Avatar name={membership.org_name} seed={membership.org_id} className="size-5 rounded-[5px] text-[0.5625rem]" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body leading-tight font-medium">{membership.org_name}</span>
              <span className="block text-caption leading-tight text-muted">
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
