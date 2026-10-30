import {
  Bot,
  Building2,
  FileBarChart,
  LayoutGrid,
  LogOut,
  Store,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router'
import { useAuth } from '@/auth/auth-context'
import { OrgSwitcher } from '@/features/orgs/OrgSwitcher'
import { useOrg } from '@/features/orgs/org-context'
import { t, type StringKey } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { Wordmark } from './Wordmark'

interface NavItem {
  to: string
  label: StringKey
  icon: LucideIcon
  disabled?: boolean
  end?: boolean
  hideForViewer?: boolean
}

const PRIMARY: NavItem[] = [
  { to: '/', label: 'nav.overview', icon: LayoutGrid, end: true },
  { to: '/imports', label: 'nav.imports', icon: Upload, disabled: true },
  { to: '/assistant', label: 'nav.assistant', icon: Bot, disabled: true },
  { to: '/reports', label: 'nav.reports', icon: FileBarChart, disabled: true },
]

const SETTINGS: NavItem[] = [
  { to: '/settings/organisation', label: 'nav.organisation', icon: Building2 },
  { to: '/settings/members', label: 'nav.members', icon: Users, hideForViewer: true },
  { to: '/settings/branches', label: 'nav.branches', icon: Store },
]

function Item({ item }: { item: NavItem }) {
  const Icon = item.icon
  if (item.disabled) {
    return (
      <li>
        <span
          aria-disabled="true"
          className="flex cursor-not-allowed items-start gap-3 rounded-md px-3 py-2 text-sm text-white/45"
        >
          <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{t(item.label)}</span>
            <span className="text-2xs text-white/40">{t('common.comingLater')}</span>
          </span>
        </span>
      </li>
    )
  }
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-white/10 font-medium text-white before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-[#7fb8a0]'
              : 'text-white/75 hover:bg-white/5 hover:text-white',
          )
        }
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{t(item.label)}</span>
      </NavLink>
    </li>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me, role } = useOrg()
  const { signOut } = useAuth()
  return (
    <nav
      aria-label={t('nav.menu')}
      className="flex h-full flex-col bg-petrol text-white"
      onClick={(e) => {
        // Close the phone drawer after any navigation inside it.
        if ((e.target as HTMLElement).closest('a[href], [role="menuitemradio"]')) onNavigate?.()
      }}
    >
      <div className="flex h-14 items-center px-5 lg:h-16">
        <Wordmark />
      </div>
      <div className="px-3 pb-4">
        <OrgSwitcher />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          {PRIMARY.map((item) => (
            <Item key={item.to} item={item} />
          ))}
        </ul>
        <p className="mt-6 mb-1.5 px-3 text-xs text-white/50">{t('nav.settings')}</p>
        <ul className="flex flex-col gap-0.5">
          {SETTINGS.filter((item) => !(item.hideForViewer && role === 'viewer')).map((item) => (
            <Item key={item.to} item={item} />
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          {me.full_name && <p className="truncate text-sm text-white">{me.full_name}</p>}
          <p className="truncate text-xs text-white/60">{me.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label={t('common.signOut')}
          title={t('common.signOut')}
          className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </nav>
  )
}
