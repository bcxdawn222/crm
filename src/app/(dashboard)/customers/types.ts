export interface CustomerFollowUp {
  id?: string
  type?: string
  content?: string
  result?: string | null
  nextAction?: string | null
  nextFollowUpAt?: string | null
  status?: string
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  company?: string
  phone: string
  email?: string
  address?: string
  category: string
  source: string
  notes?: string
  status: string
  salesId: string
  createdAt: string
  updatedAt: string
  isPublic: boolean
  sales?: { realName: string }
  _count?: { followUps: number; orders: number }
  followUps?: CustomerFollowUp[]
}

export interface CustomerFormValues {
  name: string
  company?: string
  phone: string
  email?: string
  address?: string
  category?: string
  source?: string
  notes?: string
  status?: string
}

export interface CustomerFilters {
  keyword: string
  category?: string
  status?: string
}

export interface CustomerListResponse {
  success: true
  data: { list: Customer[]; total: number }
}

export interface CustomerMutationResponse {
  success: true
  data?: Customer
}

export interface CustomerImportResponse {
  success: true
  data: { count: number }
}
