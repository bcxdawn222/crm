import { CustomerStatus, type Prisma } from '@prisma/client'

import { buildDataFilter, canAccessSalesData } from '@/lib/data-permission'

import { ORDER_ELIGIBLE_CUSTOMER_STATUSES } from './sop-contracts'

const eligibleStatuses = ORDER_ELIGIBLE_CUSTOMER_STATUSES as readonly CustomerStatus[]

export function isOrderEligibleStatus(status: CustomerStatus): boolean {
  return eligibleStatuses.includes(status)
}

export async function buildOrderEligibleCustomerWhere(
  actorId: string,
  roles: string[],
): Promise<Prisma.CustomerWhereInput> {
  return {
    ...await buildDataFilter(actorId, roles),
    isPublic: false,
    status: { in: [...eligibleStatuses] },
  }
}

export async function checkOrderEligibility(
  actorId: string,
  roles: string[],
  customer: { status: CustomerStatus; isPublic: boolean; salesId: string },
): Promise<string | null> {
  if (customer.isPublic) return '公海客户需认领后才能创建订单'
  if (!isOrderEligibleStatus(customer.status)) return '只有活跃或已合作客户可以创建订单'
  if (!await canAccessSalesData(actorId, roles, customer.salesId)) return '无权为该客户创建订单'
  return null
}
