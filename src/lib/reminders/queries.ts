import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const MAX_ROWS_PER_REMINDER_TYPE = 25

export interface ReminderQueryInput {
  customerWhere: Prisma.CustomerWhereInput
  accessibleUserIds: string[] | null
  now: Date
}

export async function loadReminderRows(input: ReminderQueryInput) {
  const threeDaysAgo = new Date(input.now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const sevenDaysLater = new Date(input.now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysLater = new Date(input.now.getTime() + 30 * 24 * 60 * 60 * 1000)

  return Promise.all([
    prisma.customer.findMany({
      where: {
        ...input.customerWhere,
        isPublic: false,
        status: 'ACTIVE',
        reminderDisabled: false,
        OR: [{ lastFollowUpAt: { lt: threeDaysAgo } }, { lastFollowUpAt: null }],
      },
      select: { id: true, name: true, company: true, phone: true, lastFollowUpAt: true },
      orderBy: { lastFollowUpAt: { sort: 'asc', nulls: 'first' } },
      take: MAX_ROWS_PER_REMINDER_TYPE,
    }),
    prisma.customer.findMany({
      where: {
        ...input.customerWhere,
        isPublic: false,
        status: 'COOPERATING',
        reminderDisabled: false,
        contractEndDate: { gte: input.now, lte: thirtyDaysLater },
      },
      select: { id: true, name: true, company: true, contractEndDate: true, contractAmount: true },
      orderBy: { contractEndDate: 'asc' },
      take: MAX_ROWS_PER_REMINDER_TYPE,
    }),
    prisma.customer.findMany({
      where: {
        ...input.customerWhere,
        isPublic: false,
        status: 'COOPERATING',
        reminderDisabled: false,
        nextVisitAt: { gte: input.now, lte: sevenDaysLater },
      },
      select: { id: true, name: true, company: true, nextVisitAt: true, visitFrequency: true },
      orderBy: { nextVisitAt: 'asc' },
      take: MAX_ROWS_PER_REMINDER_TYPE,
    }),
    prisma.followUp.findMany({
      where: {
        ...(input.accessibleUserIds === null ? {} : { salesId: { in: input.accessibleUserIds } }),
        status: 'PLANNED',
        nextFollowUpAt: { gte: input.now, lte: sevenDaysLater },
      },
      select: {
        id: true,
        customerId: true,
        content: true,
        nextFollowUpAt: true,
        customer: { select: { name: true, company: true } },
      },
      orderBy: { nextFollowUpAt: 'asc' },
      take: MAX_ROWS_PER_REMINDER_TYPE,
    }),
  ])
}
