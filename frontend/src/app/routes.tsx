import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { FullPageSpinner, LoadingBlock } from '@/components/states'
import { LoginPage } from '@/features/auth/LoginPage'
import { OrgGate } from '@/features/orgs/OrgGate'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'
import { PublicOnly, RequireAuth } from './guards'

const SignupPage = lazy(() => import('@/features/auth/SignupPage').then((m) => ({ default: m.SignupPage })))
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
)
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
)
const OnboardingPage = lazy(() => import('@/features/orgs/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const InvitePage = lazy(() => import('@/features/orgs/InvitePage').then((m) => ({ default: m.InvitePage })))
const OrgSettingsPage = lazy(() =>
  import('@/features/orgs/OrgSettingsPage').then((m) => ({ default: m.OrgSettingsPage })),
)
const MembersPage = lazy(() => import('@/features/members/MembersPage').then((m) => ({ default: m.MembersPage })))
const ImportsPage = lazy(() => import('@/features/imports/ImportsPage').then((m) => ({ default: m.ImportsPage })))
const ImportWizardPage = lazy(() =>
  import('@/features/imports/ImportWizardPage').then((m) => ({ default: m.ImportWizardPage })),
)
const BranchesPage = lazy(() => import('@/features/branches/BranchesPage').then((m) => ({ default: m.BranchesPage })))

const page = (el: React.ReactNode) => <Suspense fallback={<FullPageSpinner />}>{el}</Suspense>
const inApp = (el: React.ReactNode) => <Suspense fallback={<LoadingBlock />}>{el}</Suspense>

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={page(<SignupPage />)} />
        <Route path="/forgot-password" element={page(<ForgotPasswordPage />)} />
      </Route>
      <Route path="/reset-password" element={page(<ResetPasswordPage />)} />
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={page(<OnboardingPage />)} />
        <Route path="/invite/:token" element={page(<InvitePage />)} />
        <Route element={<OrgGate />}>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="imports" element={inApp(<ImportsPage />)} />
            <Route path="imports/new" element={inApp(<ImportWizardPage />)} />
            <Route path="settings/organisation" element={inApp(<OrgSettingsPage />)} />
            <Route path="settings/members" element={inApp(<MembersPage />)} />
            <Route path="settings/branches" element={inApp(<BranchesPage />)} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
