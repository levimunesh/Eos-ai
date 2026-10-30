import { t } from '@/lib/strings'

export function accessSummary(allBranches: boolean, branchIds: string[], branchNames: Map<string, string>) {
  if (allBranches) return { label: t('members.allBranches'), title: undefined }
  const names = branchIds.map((id) => branchNames.get(id) ?? id)
  if (names.length === 0) return { label: t('members.noBranches'), title: undefined }
  if (names.length === 1) return { label: names[0], title: names[0] }
  if (names.length === 2) return { label: names.join(', '), title: names.join(', ') }
  return { label: t('members.someBranches', { count: names.length }), title: names.join(', ') }
}

export function inviteLink(token: string, origin = window.location.origin) {
  return `${origin}/invite/${token}`
}
