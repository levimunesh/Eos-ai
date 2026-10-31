import { Bot, Building2, FileBarChart, LayoutGrid, ReceiptText, Store, Upload, Users, type LucideIcon } from 'lucide-react'
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
  { to: '/records/sales', label: 'nav.salesRecords', icon: ReceiptText },
  { to: '/imports', label: 'nav.imports', icon: Upload, hideForViewer: true },
  { to: '/assistant', label: 'nav.assistant', icon: Bot, disabled: true },
  { to: '/reports', label: 'nav.reports', icon: FileBarChart, disabled: true },
]

export const SETTINGS_NAV: NavItem[] = [
  { to: '/settings/organisation', label: 'nav.organisation', icon: Building2 },
  { to: '/settings/members', label: 'nav.members', icon: Users, hideForViewer: true },
  { to: '/settings/branches', label: 'nav.branches', icon: Store },
]

export function visiblePrimary(role: string) {
  return PRIMARY_NAV.filter((item) => !(item.hideForViewer && role === 'viewer'))
}

export function visibleSettings(role: string) {
  return SETTINGS_NAV.filter((item) => !(item.hideForViewer && role === 'viewer'))
}

/** Breadcrumb trail for a path: [section?, page]. */
export function crumbsFor(pathname: string): StringKey[] {
  const settings = SETTINGS_NAV.find((n) => pathname.startsWith(n.to))
  if (settings) return ['nav.settings', settings.label]
  if (pathname.startsWith('/records/sales')) return ['nav.salesRecords']
  if (pathname.startsWith('/imports/new')) return ['nav.imports', 'imports.wizard.title']
  if (pathname.startsWith('/imports')) return ['nav.imports']
  return ['nav.overview']
}
