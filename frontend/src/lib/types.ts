export type Role = 'owner' | 'manager' | 'viewer'
export const ROLES: Role[] = ['owner', 'manager', 'viewer']

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
export const DATE_FORMATS: DateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

export interface MembershipSummary {
  org_id: string
  org_name: string
  role: Role
  is_demo: boolean
}

export interface Me {
  id: string
  email: string
  full_name: string | null
  memberships: MembershipSummary[]
}

export interface Org {
  id: string
  name: string
  base_currency: string
  currency_decimals: number
  timezone: string
  fiscal_year_start_month: number
  tax_rate: string
  prices_include_tax: boolean
  date_format: DateFormat
  is_demo: boolean
  created_at: string
}

export interface OrgCreate {
  name: string
  base_currency: string
  timezone: string
  fiscal_year_start_month: number
  tax_rate: string
  prices_include_tax: boolean
  date_format: DateFormat
}

export type OrgSettingsUpdate = Partial<Omit<OrgCreate, 'base_currency'>>

export interface Member {
  membership_id: string
  user_id: string
  email: string
  full_name: string | null
  role: Role
  all_branches: boolean
  branch_ids: string[]
}

export interface MemberUpdate {
  role?: Role
  all_branches?: boolean
  branch_ids?: string[]
}

export interface Invitation {
  id: string
  email: string
  role: Role
  all_branches: boolean
  branch_ids: string[]
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface InvitationCreated extends Invitation {
  token: string
}

export interface InvitationCreate {
  email: string
  role: Role
  all_branches: boolean
  branch_ids: string[]
}

export interface Branch {
  id: string
  code: string
  name: string
  city: string | null
  is_active: boolean
  created_at: string
}

export interface BranchCreate {
  code: string
  name: string
  city?: string | null
}

export interface BranchUpdate {
  name?: string
  city?: string | null
  is_active?: boolean
}
