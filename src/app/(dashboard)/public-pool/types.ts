export interface PublicPoolCustomer {
  id: string
  name: string
  company?: string
  phone: string
  email?: string
  category: string
  status: string
  salesId: string
  createdAt: string
  lastFollowUpAt?: string
  publicPoolEnteredAt?: string
  publicPoolReason?: string
  sales?: { realName: string }
  _count?: { followUps: number; orders: number }
}

export interface PublicPoolStatistics {
  overview: { total: number; todayAdded: number; weekClaimed: number; avgStayDays: number }
  byReason: Array<{ reason: string; count: number }>
  trend: Array<{ date: string; enterCount: number; claimCount: number }>
}

export interface QuotaStatus {
  quota: { maxActiveCustomers: number; maxDailyClaims: number; claimHoldDays: number }
  usage: { activeCount: number; todayClaims: number }
  canClaim: boolean
  isAdmin: boolean
}
