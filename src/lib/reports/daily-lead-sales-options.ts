import type { Prisma } from '@prisma/client'

import { getAccessibleUserIds } from '@/lib/data-permission'
import { prisma } from '@/lib/prisma'

const SALES_ROLE_NAMES = ['sales', 'sales_manager']

export interface DailyLeadSalesOption {
  id: string
  realName: string
  username: string
}

export async function listDailyLeadSalesOptions(
  userId: string,
  roles: readonly string[]
): Promise<DailyLeadSalesOption[]> {
  const accessibleUserIds = await getAccessibleUserIds(userId, roles)
  const scope: Prisma.UserWhereInput = accessibleUserIds === null
    ? {}
    : { id: { in: accessibleUserIds } }

  return prisma.user.findMany({
    where: {
      AND: [
        scope,
        { status: 'ACTIVE' },
        { roles: { some: { role: { name: { in: SALES_ROLE_NAMES } } } } },
      ],
    },
    orderBy: [{ realName: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      realName: true,
      username: true,
    },
  })
}
