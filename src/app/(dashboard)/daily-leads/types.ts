export interface DailyLeadCustomer {
  id: string
  name: string
  company?: string
  phone?: string
  email?: string
  level: string
  source?: string
  notes?: string
  createdAt: string
  isPublic?: boolean
  sales?: {
    id: string
    realName: string
    username: string
  }
}

export interface DailyLeadStat {
  date: string
  count: number
  customers: DailyLeadCustomer[]
  byLevel: {
    POTENTIAL: number
    NORMAL: number
    IMPORTANT: number
    VIP: number
  }
  bySource: Record<string, number>
}

export interface SalesOption {
  id: string
  realName: string
  username: string
}

export interface DailyLeadResponse {
  success: true
  data: DailyLeadStat[]
  total: number
}

export function sourceLabel(source?: string): string {
  if (!source) return '其他'
  const labels: Record<string, string> = {
    WEBSITE: '官网',
    REFERRAL: '转介绍',
    ADVERTISEMENT: '广告',
    EXHIBITION: '展会',
    COLD_CALL: '电销',
    SOCIAL_MEDIA: '社交媒体',
    OTHER: '其他',
  }
  return labels[source] || source
}
