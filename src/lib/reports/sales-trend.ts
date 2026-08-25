import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export type TrendPeriod = '7d' | '30d' | '90d' | 'ytd'
export type TrendGranularity = 'day' | 'week' | 'month'

interface CountRow {
  bucket: string
  count: bigint
}

interface RevenueRow extends CountRow {
  revenue: Prisma.Decimal | null
}

function localDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isoWeekKey(value: Date): string {
  const utc = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function resolvePeriod(period: string, now: Date): {
  period: TrendPeriod
  startDate: Date
  granularity: TrendGranularity
} {
  if (period === '7d') return { period, startDate: new Date(now.getTime() - 7 * 86400000), granularity: 'day' }
  if (period === '90d') return { period, startDate: new Date(now.getTime() - 90 * 86400000), granularity: 'week' }
  if (period === 'ytd') return { period, startDate: new Date(now.getFullYear(), 0, 1), granularity: 'month' }
  return { period: '30d', startDate: new Date(now.getTime() - 30 * 86400000), granularity: 'day' }
}

function bucketExpression(granularity: TrendGranularity): Prisma.Sql {
  if (granularity === 'week') return Prisma.raw("DATE_FORMAT(createdAt, '%x-W%v')")
  if (granularity === 'month') return Prisma.raw("DATE_FORMAT(createdAt, '%Y-%m')")
  return Prisma.raw("DATE_FORMAT(createdAt, '%Y-%m-%d')")
}

function scope(field: string, accessibleUserIds: string[] | null): Prisma.Sql {
  if (accessibleUserIds === null) return Prisma.sql`1 = 1`
  if (accessibleUserIds.length === 0) return Prisma.sql`1 = 0`
  return Prisma.sql`${Prisma.raw(field)} IN (${Prisma.join(accessibleUserIds)})`
}

function sequence(startDate: Date, now: Date, granularity: TrendGranularity): string[] {
  const keys: string[] = []
  const current = new Date(startDate)
  while (current <= now) {
    const key = granularity === 'day'
      ? localDateKey(current)
      : granularity === 'week'
        ? isoWeekKey(current)
        : localDateKey(current).slice(0, 7)
    if (keys[keys.length - 1] !== key) keys.push(key)
    if (granularity === 'day') current.setDate(current.getDate() + 1)
    else if (granularity === 'week') current.setDate(current.getDate() + 7)
    else current.setMonth(current.getMonth() + 1, 1)
  }
  const currentKey = granularity === 'day'
    ? localDateKey(now)
    : granularity === 'week'
      ? isoWeekKey(now)
      : localDateKey(now).slice(0, 7)
  if (keys[keys.length - 1] !== currentKey) keys.push(currentKey)
  return keys
}

export async function querySalesTrend(input: {
  period: string
  accessibleUserIds: string[] | null
  now: Date
}) {
  const resolved = resolvePeriod(input.period, input.now)
  const bucket = bucketExpression(resolved.granularity)
  const [orders, customers, followUps] = await Promise.all([
    prisma.$queryRaw<RevenueRow[]>(Prisma.sql`
      SELECT ${bucket} AS bucket, COUNT(*) AS count, SUM(contractAmount) AS revenue
      FROM \`Order\`
      WHERE createdAt >= ${resolved.startDate} AND ${scope('salesId', input.accessibleUserIds)}
      GROUP BY ${bucket}
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT ${bucket} AS bucket, COUNT(*) AS count
      FROM Customer
      WHERE createdAt >= ${resolved.startDate} AND ${scope('salesId', input.accessibleUserIds)}
      GROUP BY ${bucket}
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT ${bucket} AS bucket, COUNT(*) AS count
      FROM FollowUp
      WHERE createdAt >= ${resolved.startDate} AND ${scope('salesId', input.accessibleUserIds)}
      GROUP BY ${bucket}
    `),
  ])
  const orderMap = new Map(orders.map((row) => [row.bucket, row]))
  const customerMap = new Map(customers.map((row) => [row.bucket, Number(row.count)]))
  const followUpMap = new Map(followUps.map((row) => [row.bucket, Number(row.count)]))
  return {
    period: resolved.period,
    granularity: resolved.granularity,
    dataPoints: sequence(resolved.startDate, input.now, resolved.granularity).map((date) => ({
      date,
      revenue: Number(orderMap.get(date)?.revenue ?? 0),
      orders: Number(orderMap.get(date)?.count ?? 0),
      newCustomers: customerMap.get(date) ?? 0,
      followUps: followUpMap.get(date) ?? 0,
    })),
  }
}
