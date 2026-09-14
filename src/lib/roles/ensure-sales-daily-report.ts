import { prisma } from '@/lib/prisma'

export const SALES_DAILY_REPORT_PERMISSIONS = [
  'report:daily:create',
  'report:daily:view',
  'report:daily:update',
] as const

export async function ensureSalesDailyReportPermissions(): Promise<void> {
  const salesRole = await prisma.role.findUnique({
    where: { name: 'sales' },
    select: { id: true },
  })
  if (!salesRole) {
    throw new Error('销售角色不存在，无法补齐日报权限')
  }

  const permissions = await prisma.permission.findMany({
    where: { code: { in: [...SALES_DAILY_REPORT_PERMISSIONS] } },
    select: { id: true, code: true },
  })
  if (permissions.length !== SALES_DAILY_REPORT_PERMISSIONS.length) {
    throw new Error('日报权限码缺失，无法补齐销售角色')
  }

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: salesRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: salesRole.id,
        permissionId: permission.id,
      },
    })
  }
}

let ensureOnce: Promise<void> | null = null

export function ensureSalesDailyReportPermissionsOnce(): Promise<void> {
  if (!ensureOnce) {
    ensureOnce = ensureSalesDailyReportPermissions()
  }
  return ensureOnce
}
