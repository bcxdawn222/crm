import { CustomerLevel, CustomerSource, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface DailyLeadQuery {
  accessibleUserIds: string[] | null
  salesId?: string
  startDate?: Date
  endDate?: Date
  page: number
  pageSize: number
}

interface DailyLeadSummaryRow {
  date: string
  count: bigint
  potential: bigint
  normal: bigint
  important: bigint
  vip: bigint
}

function buildWhere(query: DailyLeadQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = []
  if (query.accessibleUserIds !== null) {
    if (query.accessibleUserIds.length === 0) return Prisma.sql`1 = 0`
    conditions.push(Prisma.sql`salesId IN (${Prisma.join(query.accessibleUserIds)})`)
  }
  if (query.salesId) conditions.push(Prisma.sql`salesId = ${query.salesId}`)
  if (query.startDate) conditions.push(Prisma.sql`createdAt >= ${query.startDate}`)
  if (query.endDate) conditions.push(Prisma.sql`createdAt <= ${query.endDate}`)
  return conditions.length > 0 ? Prisma.join(conditions, ' AND ') : Prisma.sql`1 = 1`
}

function dayBounds(date: string): { gte: Date; lte: Date } {
  return {
    gte: new Date(`${date}T00:00:00.000Z`),
    lte: new Date(`${date}T23:59:59.999Z`),
  }
}

export async function queryDailyLeads(query: DailyLeadQuery) {
  const where = buildWhere(query)
  const offset = (query.page - 1) * query.pageSize
  const [countRows, summaries] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS total
      FROM (SELECT DATE(createdAt) FROM Customer WHERE ${where} GROUP BY DATE(createdAt)) dates
    `),
    prisma.$queryRaw<DailyLeadSummaryRow[]>(Prisma.sql`
      SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS date,
             COUNT(*) AS count,
             SUM(level = ${CustomerLevel.POTENTIAL}) AS potential,
             SUM(level = ${CustomerLevel.NORMAL}) AS normal,
             SUM(level = ${CustomerLevel.IMPORTANT}) AS important,
             SUM(level = ${CustomerLevel.VIP}) AS vip
      FROM Customer
      WHERE ${where}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
      ORDER BY DATE_FORMAT(createdAt, '%Y-%m-%d') DESC
      LIMIT ${query.pageSize} OFFSET ${offset}
    `),
  ])

  if (summaries.length === 0) {
    return { list: [], total: Number(countRows[0]?.total ?? 0) }
  }

  const dateFilters = summaries.map(({ date }) => ({ createdAt: dayBounds(date) }))
  const customers = await prisma.customer.findMany({
    where: {
      AND: [
        query.accessibleUserIds === null ? {} : { salesId: { in: query.accessibleUserIds } },
        query.salesId ? { salesId: query.salesId } : {},
        { OR: dateFilters },
      ],
    },
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      email: true,
      level: true,
      source: true,
      notes: true,
      isPublic: true,
      createdAt: true,
      sales: { select: { id: true, realName: true, username: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  })

  const customersByDate = new Map<string, typeof customers>()
  for (const customer of customers) {
    const date = customer.createdAt.toISOString().slice(0, 10)
    const current = customersByDate.get(date) ?? []
    current.push(customer)
    customersByDate.set(date, current)
  }

  return {
    total: Number(countRows[0]?.total ?? 0),
    list: summaries.map((summary) => {
      const dayCustomers = customersByDate.get(summary.date) ?? []
      const bySource = dayCustomers.reduce<Partial<Record<CustomerSource, number>>>((counts, customer) => {
        const source = customer.source ?? CustomerSource.OTHER
        counts[source] = (counts[source] ?? 0) + 1
        return counts
      }, {})
      return {
        date: summary.date,
        count: Number(summary.count),
        customers: dayCustomers,
        byLevel: {
          POTENTIAL: Number(summary.potential),
          NORMAL: Number(summary.normal),
          IMPORTANT: Number(summary.important),
          VIP: Number(summary.vip),
        },
        bySource,
      }
    }),
  }
}
