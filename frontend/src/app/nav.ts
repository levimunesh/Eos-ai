import { Bot, Building2, FileBarChart, LayoutGrid, Store, Upload, Users, type LucideIcon } from 'lucide-react'
import type { StringKey } from '@/lib/strings'

export interface NavItem {
  to: string
  label: StringKey
  icon: LucideIcon
  disabled?: boolean
  end?: boolean
  hideForViewer?: boolean
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'nav.overview', icon: LayoutGrid, end: true },
  { to: '/imports', label: 'nav.imports', icon: Upload, disabled: true },
  { to: '/assistant', label: 'nav.assistant', icon: Bot, disabled: true },
  { to: '/reports', label: 'nav.reports', icon: FileBarChart, disabled: true },
]

export const SETTINGS_NAV: NavItem[] = [
  { to: '/settings/organisation', label: 'nav.organisation', icon: Building2 },
  { to: '/settings/members', label: 'nav.members', icon: Users, hideForViewer: true },
  { to: '/settings/branches', label: 'nav.branches', icon: Store },
]

export function visibleSettings(role: string) {
  return SETTINGS_NAV.filter((item) => !(item.hideForViewer && role === 'viewer'))
}

/** Breadcrumb trail for a path: [section?, page]. */
export function crumbsFor(pathname: string): StringKey[] {
  const settings = SETTINGS_NAV.find((n) => pathname.startsWith(n.to))
  if (settings) return ['nav.settings', settings.label]
  return ['nav.overview']
}
