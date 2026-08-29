export const ORDER_ELIGIBLE_CUSTOMER_STATUSES = ['ACTIVE', 'COOPERATING'] as const

export type OrderEligibleCustomerStatus = typeof ORDER_ELIGIBLE_CUSTOMER_STATUSES[number]

export interface CustomerDetailFollowUp {
  id: string
  type: string
  content: string
  result: string | null
  nextAction: string | null
  nextFollowUpAt: string | null
  status: string
  createdAt: string
  sales?: { id: string; realName: string } | null
}

export interface CustomerDetailOrder {
  id: string
  orderNo: string
  contractNo: string | null
  contractAmount: number
  paidAmount: number
  unpaidAmount: number
  currency: string
  status: string
  signDate: string | null
  createdAt: string
}

export interface DashboardResourceState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  updatedAt: string | null
}
