import { Building2, LayoutGrid, ReceiptText, Sparkles, Store, Upload, Users, type LucideIcon } from 'lucide-react'
import type { StringKey } from '@/lib/strings'

export interface NavItem {
  to: string
  label: StringKey
  icon: LucideIcon
  disabled?: boolean
  end?: boolean
  hideForViewer?: boolean
  /** Opens the Ask EOS panel instead of navigating. */
  ask?: boolean
}

export interface NavGroup {
  label: StringKey
  items: NavItem[]
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'nav.overview', icon: LayoutGrid, end: true },
  { to: '/records/sales', label: 'nav.salesRecords', icon: ReceiptText },
  { to: '/imports', label: 'nav.imports', icon: Upload, hideForViewer: true },
]

export const ASK_NAV: NavItem = { to: '/ask', label: 'nav.ask', icon: Sparkles, ask: true }

export const SETTINGS_NAV: NavItem[] = [
  { to: '/settings/organisation', label: 'nav.organisation', icon: Building2 },
  { to: '/settings/members', label: 'nav.members', icon: Users, hideForViewer: true },
  { to: '/settings/branches', label: 'nav.branches', icon: Store },
]

const forRole = (items: NavItem[], role: string) => items.filter((item) => !item.disabled && !(item.hideForViewer && role === 'viewer'))

export function visiblePrimary(role: string) {
  return forRole(PRIMARY_NAV, role)
}

export function visibleSettings(role: string) {
  return forRole(SETTINGS_NAV, role)
}

/** Sidebar groups: Analyse / Data / Ask EOS / Settings. Disabled items are hidden, not greyed. */
export function navGroups(role: string): NavGroup[] {
  const primary = visiblePrimary(role)
  const groups: NavGroup[] = [
    { label: 'nav.groupAnalyse', items: primary.filter((i) => i.to !== '/imports') },
    { label: 'nav.groupData', items: primary.filter((i) => i.to === '/imports') },
    { label: 'nav.groupAsk', items: [ASK_NAV] },
    { label: 'nav.settings', items: visibleSettings(role) },
  ]
  return groups.filter((g) => g.items.length > 0)
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
