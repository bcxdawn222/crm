import type { Dayjs } from 'dayjs'

export interface CooperatingCustomer {
  id: string
  name: string
  company?: string
  contactPerson?: string
  phone?: string
  contractStartDate?: string
  contractEndDate?: string
  contractAmount?: number | string
  renewalReminderDays?: number
  lastVisitAt?: string
  nextVisitAt?: string
  visitFrequency?: string
  cooperationNotes?: string
  createdAt: string
  sales?: { id: string; realName: string }
  operationManager?: { id: string; realName: string }
  operationManagerId?: string
}

export interface CooperatingFormValues {
  contractStartDate?: Dayjs | null
  contractEndDate: Dayjs | null
  contractAmount?: number
  renewalReminderDays?: number
  operationManagerId?: string
  lastVisitAt?: Dayjs | null
  nextVisitAt?: Dayjs | null
  visitFrequency?: string
  cooperationNotes?: string
}

export interface OperationManagerOption {
  id: string
  realName: string
  username: string
  department?: string | null
  position?: string | null
}
