import type { Dayjs } from 'dayjs'

export interface DailyReport {
  id: string
  reportDate: string
  content: string
  tomorrowPlan?: string
  issues?: string
  attachments?: string
  authorId: string
  reviewerId?: string
  status: string
  reviewComment?: string
  createdAt: string
  author?: { realName: string; avatar?: string }
  reviewer?: { realName: string }
  _count?: { comments: number }
}

export interface DailyReportFormValues {
  reportDate?: Dayjs
  content?: string
  tomorrowPlan?: string
  issues?: string
}

export interface DailyReportDraft {
  reportDate?: string
  content?: string
  tomorrowPlan?: string
  issues?: string
}

export const statusMap: Record<string, { text: string; color: string }> = {
  DRAFT: { text: '草稿', color: 'default' },
  SUBMITTED: { text: '已提交', color: 'blue' },
  REVIEWED: { text: '已审阅', color: 'green' },
  REJECTED: { text: '已驳回', color: 'red' },
}

export function isDailyReportDraft(value: unknown): value is DailyReportDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as DailyReportDraft
  return (draft.reportDate === undefined || typeof draft.reportDate === 'string')
    && (draft.content === undefined || typeof draft.content === 'string')
    && (draft.tomorrowPlan === undefined || typeof draft.tomorrowPlan === 'string')
    && (draft.issues === undefined || typeof draft.issues === 'string')
}
