import type { Prisma } from '@prisma/client'

import { getUserAndSubordinateIds } from '@/lib/data-permission'
import { prisma } from '@/lib/prisma'

const ASSIGNABLE_ROLE_NAMES = ['sales', 'sales_manager']

export function canCreateTask(permissions: string[], roles: string[]): boolean {
  return permissions.includes('task:create') || roles.includes('sales')
}

export async function buildTaskAssigneeWhere(
  userId: string,
  roles: string[]
): Promise<Prisma.UserWhereInput | null> {
  const roleFilter: Prisma.UserWhereInput = {
    roles: {
      some: {
        role: {
          name: { in: ASSIGNABLE_ROLE_NAMES },
        },
      },
    },
  }

  if (roles.includes('admin') || roles.includes('finance')) {
    return {
      status: 'ACTIVE',
      ...roleFilter,
    }
  }

  if (roles.includes('sales_manager')) {
    const accessibleUserIds = await getUserAndSubordinateIds(userId)
    return {
      id: { in: accessibleUserIds },
      status: 'ACTIVE',
      ...roleFilter,
    }
  }

  if (roles.includes('sales')) {
    return {
      id: userId,
      status: 'ACTIVE',
      ...roleFilter,
    }
  }

  return null
}

export async function findTaskAssigneeWithinScope(
  userId: string,
  roles: string[],
  assigneeId: string
) {
  const scope = await buildTaskAssigneeWhere(userId, roles)
  if (!scope) return null

  return prisma.user.findFirst({
    where: {
      AND: [scope, { id: assigneeId }],
    },
    select: {
      id: true,
      status: true,
    },
  })
}
