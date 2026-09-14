export interface TelemarketingSales {
  id: string
  realName: string
  username: string
}

export interface TelemarketingRecord {
  id: string
  name: string
  company?: string
  phone: string
  position?: string
  industry?: string
  source?: string
  callTimes: number
  lastCallAt?: string
  callDuration?: number
  status: string
  result?: string | null
  notes?: string
  isEffective: boolean
  salesId: string
  customerId?: string
  createdAt: string
  sales?: TelemarketingSales
  customer?: { id: string; name: string; phone: string }
}

export interface TelemarketingFormValues {
  name: string
  company?: string
  phone: string
  position?: string
  industry?: string
  source?: string
  notes?: string
  status?: string
  result?: string | null
  isEffective?: boolean
  salesId?: string
}

export interface TelemarketingListResponse {
  success: true
  data: { list: TelemarketingRecord[]; total: number }
}

export interface TelemarketingMutationResponse {
  success: true
}

export interface TelemarketingOwner {
  id: string
  realName: string
  username: string
}

export const TELEMARKETING_STATUS_OPTIONS = [
  { value: 'PENDING', label: '待拨打' },
  { value: 'CONNECTED', label: '已接通' },
  { value: 'NOT_ANSWERED', label: '未接听' },
  { value: 'BUSY', label: '忙线' },
  { value: 'INVALID', label: '无效号码' },
  { value: 'CALLBACK', label: '需回拨' },
  { value: 'FOLLOW_UP', label: '需跟进' },
  { value: 'CONVERTED', label: '已转化' },
]

export const TELEMARKETING_RESULT_OPTIONS = [
  { value: 'INTERESTED', label: '有意向' },
  { value: 'NOT_INTERESTED', label: '无意向' },
  { value: 'NEED_FOLLOWUP', label: '需跟进' },
  { value: 'WRONG_NUMBER', label: '错号' },
  { value: 'EMPTY_NUMBER', label: '空号' },
  { value: 'OTHER', label: '其他' },
]
