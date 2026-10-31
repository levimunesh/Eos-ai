import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Avatar } from '@/components/ui/avatar'
import {
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown'
import { useOrg } from '@/features/orgs/org-context'
import { t } from '@/lib/strings'
import type { ThemePref } from '@/lib/theme'
import { useTheme } from '@/lib/theme-context'

export function UserMenu() {
  const { me } = useOrg()
  const { signOut } = useAuth()
  const { pref, setPref } = useTheme()
  const name = me.full_name || me.email

  return (
    <DropdownMenu>
      <DropdownTrigger
        aria-label={t('shell.userMenu')}
        className="ms-0.5 flex size-9 items-center justify-center rounded-full sm:size-7"
      >
        <Avatar name={name} seed={me.id} className="size-6 text-[0.625rem]" />
      </DropdownTrigger>
      <DropdownContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar name={name} seed={me.id} />
          <div className="min-w-0">
            {me.full_name && <p className="truncate text-sm font-medium">{me.full_name}</p>}
            <p className="truncate text-xs text-muted">{me.email}</p>
          </div>
        </div>
        <DropdownSeparator />
        <DropdownLabel>{t('theme.label')}</DropdownLabel>
        <DropdownRadioGroup value={pref} onValueChange={(v) => setPref(v as ThemePref)}>
          <DropdownRadioItem value="light">
            <Sun aria-hidden />
            {t('theme.light')}
          </DropdownRadioItem>
          <DropdownRadioItem value="dark">
            <Moon aria-hidden />
            {t('theme.dark')}
          </DropdownRadioItem>
          <DropdownRadioItem value="system">
            <Monitor aria-hidden />
            {t('theme.system')}
          </DropdownRadioItem>
        </DropdownRadioGroup>
        <DropdownSeparator />
        <DropdownItem onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          {t('common.signOut')}
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  )
}
