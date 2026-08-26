import { z } from 'zod'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export const dateOnlySchema = z
  .string()
  .regex(DATE_ONLY_PATTERN, '日期格式必须为 YYYY-MM-DD')
  .refine(isCalendarDate, '日期不是有效的日历日期')
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

const dateRangeQuerySchema = z
  .object({
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.startDate) !== Boolean(value.endDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startDate'],
        message: '开始日期和结束日期必须同时提供',
      })
      return
    }

    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: '结束日期不能早于开始日期',
      })
    }
  })

export interface DateRange {
  startDate: Date
  endDate: Date
}

export type DateRangeResult =
  | { success: true; data?: DateRange }
  | { success: false; error: string }

export function parseDateRangeQuery(searchParams: URLSearchParams): DateRangeResult {
  const parsed = dateRangeQuerySchema.safeParse({
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? '日期范围不正确' }
  }

  if (!parsed.data.startDate || !parsed.data.endDate) return { success: true }

  const endDate = new Date(parsed.data.endDate)
  endDate.setUTCHours(23, 59, 59, 999)
  return {
    success: true,
    data: { startDate: parsed.data.startDate, endDate },
  }
}
