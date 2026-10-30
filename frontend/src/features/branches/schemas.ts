import { z } from 'zod'
import { t } from '@/lib/strings'

const city = z.string().trim().max(100, t('branches.v.city'))
const name = z.string().trim().min(1, t('branches.v.name')).max(200, t('branches.v.nameLength'))

export const branchCreateSchema = z.object({
  code: z.string().trim().min(1, t('branches.v.code')).max(50, t('branches.v.codeLength')),
  name,
  city,
})
export type BranchCreateValues = z.infer<typeof branchCreateSchema>

export const branchEditSchema = z.object({ name, city })
export type BranchEditValues = z.infer<typeof branchEditSchema>
