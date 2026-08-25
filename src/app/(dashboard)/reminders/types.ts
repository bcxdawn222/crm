export interface ReminderItem {
  type: string
  customerId?: string
  customerName: string
  company?: string
  phone?: string
  message: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  contractAmount?: number | string | null
  content?: string
  followUpId?: string
}

export interface DisabledCustomer {
  customerId: string
  customerName: string
  company?: string
  phone?: string
  reminderDisabledReason?: string
  daysSinceDisabled?: number | null
}

export interface Summary {
  totalOverdue: number
  totalExpiring: number
  totalUpcomingVisits: number
  totalPlannedFollowUps: number
  totalReminders: number
}

export interface ReminderGroups {
  overdueFollowUp: ReminderItem[]
  expiringContracts: ReminderItem[]
  upcomingVisits: ReminderItem[]
  plannedFollowUps: ReminderItem[]
  summary: Summary
}
