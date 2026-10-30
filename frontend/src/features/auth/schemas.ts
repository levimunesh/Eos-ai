import { z } from 'zod'
import { t } from '@/lib/strings'

const email = z.string().trim().pipe(z.email(t('auth.v.email')))

export const signInSchema = z.object({
  email,
  password: z.string().min(1, t('auth.v.passwordRequired')),
})
export type SignInValues = z.infer<typeof signInSchema>

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, t('auth.v.fullName')).max(200),
  email,
  password: z.string().min(8, t('auth.v.password')),
})
export type SignUpValues = z.infer<typeof signUpSchema>

export const forgotSchema = z.object({ email })
export type ForgotValues = z.infer<typeof forgotSchema>

export const resetSchema = z.object({ password: z.string().min(8, t('auth.v.password')) })
export type ResetValues = z.infer<typeof resetSchema>
