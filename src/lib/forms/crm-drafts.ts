export interface CustomerDraft {
  name?: string
  company?: string
  phone?: string
  email?: string
  address?: string
  category?: string
  source?: string
  notes?: string
  status?: string
}

export interface TelemarketingDraft {
  name?: string
  company?: string
  phone?: string
  position?: string
  industry?: string
  source?: string
  notes?: string
  status?: string
  result?: string
  salesId?: string
  isEffective?: boolean
}

export interface CooperatingCustomerDraft {
  contractStartDate?: string
  contractEndDate?: string
  contractAmount?: number
  renewalReminderDays?: number
  operationManagerId?: string
  lastVisitAt?: string
  nextVisitAt?: string
  visitFrequency?: string
  cooperationNotes?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalStrings(record: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => record[field] === undefined || typeof record[field] === 'string')
}

export function isCustomerDraft(value: unknown): value is CustomerDraft {
  return isRecord(value) && optionalStrings(value, [
    'name', 'company', 'phone', 'email', 'address', 'category', 'source', 'notes', 'status',
  ])
}

export function isTelemarketingDraft(value: unknown): value is TelemarketingDraft {
  if (!isRecord(value) || !optionalStrings(value, [
    'name', 'company', 'phone', 'position', 'industry', 'source', 'notes', 'status', 'result', 'salesId',
  ])) {
    return false
  }
  return value.isEffective === undefined || typeof value.isEffective === 'boolean'
}

export function isCooperatingCustomerDraft(value: unknown): value is CooperatingCustomerDraft {
  if (!isRecord(value)) return false
  return optionalStrings(value, [
    'contractStartDate', 'contractEndDate', 'operationManagerId', 'lastVisitAt',
    'nextVisitAt', 'visitFrequency', 'cooperationNotes',
  ])
    && (value.contractAmount === undefined || typeof value.contractAmount === 'number')
    && (value.renewalReminderDays === undefined || typeof value.renewalReminderDays === 'number')
}
