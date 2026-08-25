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
  result?: string
  notes?: string
  isEffective: boolean
  customerId?: string
  createdAt: string
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
}

export interface TelemarketingListResponse {
  success: true
  data: { list: TelemarketingRecord[]; total: number }
}

export interface TelemarketingMutationResponse {
  success: true
}
