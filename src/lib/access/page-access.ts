export interface PageAccessRule {
  path: string
  permissions: readonly string[]
}

export const PAGE_ACCESS_RULES: readonly PageAccessRule[] = [
  { path: '/admin/settings', permissions: ['setting:view', 'setting:update'] },
  { path: '/admin/roles', permissions: ['role:view', 'role:manage'] },
  { path: '/admin/users', permissions: ['user:view'] },
  { path: '/customers/cooperating', permissions: ['customer:view'] },
  { path: '/finance/payments', permissions: ['payment:view'] },
  { path: '/finance/reports', permissions: ['report:view'] },
  { path: '/finance/orders', permissions: ['order:view'] },
  { path: '/daily-reports', permissions: ['report:daily:view'] },
  { path: '/telemarketing', permissions: ['lead:view'] },
  { path: '/daily-leads', permissions: ['customer:view'] },
  { path: '/public-pool', permissions: ['customer:view'] },
  { path: '/statistics', permissions: ['report:view'] },
  { path: '/reminders', permissions: ['customer:view'] },
  { path: '/messages', permissions: ['message:view'] },
  { path: '/customers', permissions: ['customer:view'] },
  { path: '/tasks', permissions: ['task:view'] },
  { path: '/files', permissions: ['file:view'] },
  {
    path: '/admin',
    permissions: ['user:view', 'role:view', 'role:manage', 'setting:view', 'setting:update'],
  },
  { path: '/finance', permissions: ['order:view', 'payment:view', 'report:view'] },
]

export function hasAnyPermission(
  userPermissions: readonly string[],
  requiredPermissions: readonly string[]
): boolean {
  return requiredPermissions.some((permission) => userPermissions.includes(permission))
}

export function pageAccessRuleFor(pathname: string): PageAccessRule | undefined {
  return PAGE_ACCESS_RULES.find(
    (rule) => pathname === rule.path || pathname.startsWith(`${rule.path}/`)
  )
}

export function hasPageAccess(pathname: string, userPermissions: readonly string[]): boolean {
  const rule = pageAccessRuleFor(pathname)
  return !rule || hasAnyPermission(userPermissions, rule.permissions)
}
