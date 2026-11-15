import {cache} from 'react'
import {redirect} from 'next/navigation'
import {NextResponse} from 'next/server'
import {db} from '@/lib/db'
import {getAuthContext, type AuthContext} from '@/lib/auth/context'

/**
 * Admin Internal System — Role-Based Access Control.
 *
 * The coarse gate is users.role ∈ {advisor, admin} (isStaff). The granular
 * matrix below is the single source of truth for what each staff role may do,
 * enforced:
 *   1. server-side on every admin page and API action (this file);
 *   2. at the database level in production (sql/005_admin_rls.sql).
 *
 * Role resolution precedence:
 *   staff_profiles.admin_role  →  users.role fallback
 *     ('admin' => super_admin bootstrap, 'advisor' => advisor)
 */

export type AdminRole =
  | 'super_admin'
  | 'ops_lead'
  | 'advisor'
  | 'compliance'
  | 'finance'
  | 'content'
  | 'analyst'

export const ADMIN_ROLES: {role: AdminRole; label: string; blurb: string}[] = [
  {role: 'super_admin', label: 'Super Administrator', blurb: 'Full system access, role management, configuration, revenue, all data.'},
  {role: 'ops_lead', label: 'Operations Lead', blurb: 'Opportunity management, order fulfilment oversight, document control, pipeline.'},
  {role: 'advisor', label: 'Advisor / Relationship Manager', blurb: 'Assigned investors only — communications, mandates, order support.'},
  {role: 'compliance', label: 'Compliance / KYC Officer', blurb: 'Verification workflows, NDA status, access tiers, audit.'},
  {role: 'finance', label: 'Finance / Revenue', blurb: 'Orders, payments, invoices, revenue recognition, refunds, reporting.'},
  {role: 'content', label: 'Content / Research', blurb: 'Market Intelligence content, brief templates, opportunity enrichment.'},
  {role: 'analyst', label: 'Read-Only Analyst', blurb: 'Dashboards and reports only.'},
]

export type Permission =
  | 'admin.access'
  | 'overview.view'
  | 'investors.view.all'
  | 'investors.view.assigned'
  | 'investors.manage'
  | 'organisations.view'
  | 'opportunities.view'
  | 'opportunities.manage'
  | 'orders.view.all'
  | 'orders.view.assigned'
  | 'orders.manage'
  | 'payments.verify'
  | 'refunds.manage'
  | 'mandates.view'
  | 'mandates.manage'
  | 'documents.view'
  | 'documents.manage'
  | 'communications.view'
  | 'communications.reply'
  | 'compliance.view'
  | 'compliance.review'
  | 'intelligence.view'
  | 'intelligence.manage'
  | 'analytics.view'
  | 'revenue.view'
  | 'revenue.export'
  | 'settings.view'
  | 'settings.manage'
  | 'staff.manage'
  | 'audit.view'
  | 'security.view'
  | 'security.revoke'
  | 'broadcast.send'
  | 'notifications.view'
  | 'notifications.manage'
  | 'export.data'

const ALL: Permission[] = [
  'admin.access','overview.view',
  'investors.view.all','investors.view.assigned','investors.manage',
  'organisations.view',
  'opportunities.view','opportunities.manage',
  'orders.view.all','orders.view.assigned','orders.manage',
  'payments.verify','refunds.manage',
  'mandates.view','mandates.manage',
  'documents.view','documents.manage',
  'communications.view','communications.reply',
  'compliance.view','compliance.review',
  'intelligence.view','intelligence.manage',
  'analytics.view','revenue.view','revenue.export',
  'settings.view','settings.manage','staff.manage',
  'audit.view','security.view','security.revoke',
  'broadcast.send','notifications.view','notifications.manage',
  'export.data',
]

const MATRIX: Record<AdminRole, Permission[]> = {
  super_admin: ALL,
  ops_lead: [
    'admin.access','overview.view',
    'investors.view.all',
    'organisations.view',
    'opportunities.view','opportunities.manage',
    'orders.view.all','orders.manage',
    'payments.verify',
    'mandates.view','mandates.manage',
    'documents.view','documents.manage',
    'communications.view','communications.reply',
    'compliance.view',
    'intelligence.view',
    'analytics.view','revenue.view',
    'notifications.view','notifications.manage',
    'settings.view',
    'export.data',
  ],
  advisor: [
    'admin.access','overview.view',
    'investors.view.assigned',
    'organisations.view',
    'opportunities.view',
    'orders.view.assigned','orders.manage',
    'payments.verify',
    'mandates.view','mandates.manage',
    'documents.view','documents.manage',
    'communications.view','communications.reply',
    'notifications.view',
    'intelligence.view',
  ],
  compliance: [
    'admin.access','overview.view',
    'investors.view.all','investors.manage',
    'organisations.view',
    'documents.view',
    'communications.view',
    'compliance.view','compliance.review',
    'notifications.view',
    'audit.view','security.view','security.revoke',
    'export.data',
  ],
  finance: [
    'admin.access','overview.view',
    'investors.view.all',
    'orders.view.all',
    'payments.verify','refunds.manage',
    'mandates.view',
    'analytics.view','revenue.view','revenue.export',
    'export.data',
  ],
  content: [
    'admin.access','overview.view',
    'opportunities.view','opportunities.manage',
    'intelligence.view','intelligence.manage',
    'documents.view',
    'analytics.view',
  ],
  analyst: [
    'admin.access','overview.view',
    'analytics.view',
    'revenue.view','revenue.export',
    'export.data',
  ],
}

export function permissionsFor(role: AdminRole): Permission[] {
  return MATRIX[role]
}

export function roleLabel(role: AdminRole): string {
  return ADMIN_ROLES.find((r) => r.role === role)?.label ?? role
}

export function isValidAdminRole(x: string): x is AdminRole {
  return ADMIN_ROLES.some((r) => r.role === x)
}

export interface AdminContext {
  auth: AuthContext
  role: AdminRole
  permissions: Permission[]
  /** Advisors operate on assigned investors only — their scoping key. */
  advisorId: string | null
  can: (p: Permission) => boolean
}

/** Resolve the granular admin role for a signed-in staff user (request-cached). */
export const resolveAdminRole = cache(async (userId: string, coarseRole: string): Promise<AdminRole | null> => {
  const staff = await db.staffProfile.findUnique({where: {userId}})
  if (staff) return staff.isActive ? (staff.adminRole as AdminRole) : null
  if (coarseRole === 'admin') return 'super_admin'
  if (coarseRole === 'advisor') return 'advisor'
  return null
})

/** Full admin context or null (not signed in, or not staff). Request-cached. */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const auth = await getAuthContext()
  if (!auth || !auth.isStaff) return null
  const role = await resolveAdminRole(auth.user.id, auth.user.role)
  if (!role) return null
  const permissions = permissionsFor(role)
  return {
    auth,
    role,
    permissions,
    advisorId: role === 'advisor' ? auth.user.id : null,
    can: (p) => permissions.includes(p),
  }
})

/** Server-component guard for /admin pages. */
export async function requireAdminPage(): Promise<AdminContext> {
  const actx = await getAdminContext()
  if (!actx) redirect('/portal')
  return actx
}

/** API guard: granular permission check returning context or a JSON response. */
export async function requireAdminApi(permission?: Permission): Promise<{actx: AdminContext} | {response: NextResponse}> {
  const actx = await getAdminContext()
  if (!actx) {
    return {response: NextResponse.json({ok: false, error: 'Staff access required.'}, {status: 401})}
  }
  if (permission && !actx.permissions.includes(permission)) {
    return {response: NextResponse.json({ok: false, error: `Permission denied (${permission}).`}, {status: 403})}
  }
  return {actx}
}

export function isAdminResponse(x: unknown): x is {response: NextResponse} {
  return !!x && typeof x === 'object' && 'response' in (x as object)
}

/**
 * Advisor scoping — advisors see only investors assigned to them.
 * Returns a Prisma `where` fragment for investor-scoped queries, or null
 * when the actor may see all investors.
 */
export function investorScopeWhere(actx: AdminContext): {advisorId: string} | null {
  if (actx.can('investors.view.all')) return null
  return {advisorId: actx.auth.user.id}
}

/** Order status lifecycle (Orders Engine). */
export const ORDER_STATUSES = [
  'pending','awaiting_payment','payment_confirmed','processing','internal_review','ready','delivered','closed','cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ['awaiting_payment','payment_confirmed','cancelled'],
  awaiting_payment: ['payment_confirmed','cancelled'],
  payment_confirmed: ['processing','cancelled'],
  processing: ['internal_review','ready','cancelled'],
  internal_review: ['ready','processing'],
  ready: ['delivered','cancelled'],
  delivered: ['closed'],
  closed: [],
  cancelled: [],
}

export function orderTransitionAllowed(from: string, to: string): boolean {
  return (ORDER_TRANSITIONS[from] ?? []).includes(to as OrderStatus)
}

export const PRIORITIES = ['low','normal','high','urgent'] as const
export const MANDATE_STAGES = ['sourcing','qualification','matching','negotiation','closing','post_closing'] as const
