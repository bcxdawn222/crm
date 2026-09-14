import { UserStatus } from '@prisma/client'

import { canAccessSalesData, getAccessibleUserIds } from '@/lib/data-permission'
import { prisma } from '@/lib/prisma'

export function canAssignTelemarketingOwner(roles: readonly string[]): boolean {
  return roles.includes('admin') || roles.includes('sales_manager') || roles.includes('finance')
}

export async function resolveTelemarketingOwner(input: {
  actorId: string
  actorRoles: readonly string[]
  requestedSalesId?: string
}): Promise<{ salesId: string } | { error: string; status: 400 | 403 }> {
  if (!canAssignTelemarketingOwner(input.actorRoles)) {
    return { salesId: input.actorId }
  }

  const salesId = input.requestedSalesId ?? input.actorId
  if (!(await canAccessSalesData(input.actorId, input.actorRoles, salesId))) {
    return { error: '无权指定该负责人', status: 403 }
  }

  const owner = await prisma.user.findFirst({
    where: { id: salesId, status: UserStatus.ACTIVE },
    select: { id: true },
  })
  if (!owner) {
    return { error: '负责人不存在或已停用', status: 400 }
  }
  return { salesId: owner.id }
}

export async function loadAccessibleTelemarketing(
  id: string,
  actorId: string,
  actorRoles: readonly string[],
) {
  const record = await prisma.telemarketingList.findUnique({ where: { id } })
  if (!record) return { error: '电销记录不存在', status: 404 } as const
  if (!(await canAccessSalesData(actorId, actorRoles, record.salesId))) {
    return { error: '无权操作该电销记录', status: 403 } as const
  }
  return { record } as const
}

export async function listTelemarketingOwners(actorId: string, actorRoles: readonly string[]) {
  const accessibleUserIds = await getAccessibleUserIds(actorId, actorRoles)
  return prisma.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      ...(accessibleUserIds === null ? {} : { id: { in: accessibleUserIds } }),
    },
    select: { id: true, realName: true, username: true },
    orderBy: [{ realName: 'asc' }, { username: 'asc' }],
    take: 200,
  })
}

export async function findTelemarketingOwnerByLabel(
  label: string,
): Promise<{ id: string } | { error: string }> {
  const value = label.trim()
  if (!value) return { error: '请指定负责人' }

  const byUsername = await prisma.user.findFirst({
    where: { username: value, status: UserStatus.ACTIVE },
    select: { id: true },
  })
  if (byUsername) return { id: byUsername.id }

  const byName = await prisma.user.findMany({
    where: { realName: value, status: UserStatus.ACTIVE },
    select: { id: true },
  })
  if (byName.length > 1) return { error: '销售姓名匹配到多个用户' }
  const owner = byName[0]
  if (!owner) return { error: '找不到对应销售' }
  return { id: owner.id }
}
