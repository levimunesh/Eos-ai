import { z } from 'zod'
import { t } from '@/lib/strings'
import { ROLES } from '@/lib/types'

const access = {
  role: z.enum(ROLES),
  allBranches: z.boolean(),
  branchIds: z.array(z.string()),
}

function needsBranches(v: { allBranches: boolean; branchIds: string[] }) {
  return v.allBranches || v.branchIds.length > 0
}

export const accessSchema = z
  .object(access)
  .refine(needsBranches, { message: t('members.v.branches'), path: ['branchIds'] })
export type AccessValues = z.infer<typeof accessSchema>

export const inviteSchema = z
  .object({ email: z.string().trim().pipe(z.email(t('auth.v.email'))), ...access })
  .refine(needsBranches, { message: t('members.v.branches'), path: ['branchIds'] })
export type InviteValues = z.infer<typeof inviteSchema>
