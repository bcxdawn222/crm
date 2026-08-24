import { canAccessSalesData } from '@/lib/data-permission'

export interface ContractAccessUser {
  id: string
  roles: readonly string[]
  permissions: readonly string[]
}

export interface ContractCustomerOwnership {
  salesId: string
  operationManagerId: string | null
}

export async function canReadContractArchive(
  user: ContractAccessUser,
  customer: ContractCustomerOwnership
): Promise<boolean> {
  if (!user.permissions.includes('customer:view')) return false
  if (customer.operationManagerId === user.id) return true
  return canAccessSalesData(user.id, user.roles, customer.salesId)
}

export async function canWriteContractArchive(
  user: ContractAccessUser,
  salesId: string
): Promise<boolean> {
  if (!user.permissions.includes('customer:update')) return false
  return canAccessSalesData(user.id, user.roles, salesId)
}
