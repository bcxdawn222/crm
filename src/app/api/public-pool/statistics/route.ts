import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface TrendRow {
  date: string
  count: bigint
}

interface AverageStayRow {
  days: number | null
}

const reasonLabels: Record<string, string> = {
  RULE_1: '长期未跟进(90天)',
  RULE_2: '创建后未跟进(30天)',
  RULE_3: '合同到期未续签',
  RULE_4: '客户已失效',
  RULE_5: '多次跟进无进展',
  AUTO_RECYCLE: '超期自动回收',
}

function startOfDay(value: Date): Date {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

function dateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function trendMap(rows: TrendRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.date, Number(row.count)]))
}

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('read', 'customer')) {
      return NextResponse.json({ error: 'No permission to access statistics' }, { status: 403 })
    }

    const now = new Date()
    const today = startOfDay(now)
    const trendStart = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000))
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [total, todayAdded, weekClaimed, averageRows, byReason, enteredRows, claimedRows] = await Promise.all([
      prisma.customer.count({ where: { isPublic: true } }),
      prisma.customer.count({ where: { isPublic: true, publicPoolEnteredAt: { gte: today } } }),
      prisma.auditEvent.count({
        where: { action: 'CLAIM', reason: 'PUBLIC_POOL_CLAIM', createdAt: { gte: weekStart } },
      }),
      prisma.$queryRaw<AverageStayRow[]>(Prisma.sql`
        SELECT ROUND(AVG(TIMESTAMPDIFF(SECOND, publicPoolEnteredAt, ${now})) / 86400) AS days
        FROM Customer
        WHERE isPublic = TRUE AND publicPoolEnteredAt IS NOT NULL
      `),
      prisma.customer.groupBy({
        by: ['publicPoolReason'],
        where: { isPublic: true },
        _count: true,
        orderBy: { _count: { publicPoolReason: 'desc' } },
      }),
      prisma.$queryRaw<TrendRow[]>(Prisma.sql`
        SELECT DATE_FORMAT(publicPoolEnteredAt, '%Y-%m-%d') AS date, COUNT(*) AS count
        FROM Customer
        WHERE publicPoolEnteredAt >= ${trendStart}
        GROUP BY DATE_FORMAT(publicPoolEnteredAt, '%Y-%m-%d')
      `),
      prisma.$queryRaw<TrendRow[]>(Prisma.sql`
        SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS date, COUNT(*) AS count
        FROM AuditEvent
        WHERE action = 'CLAIM' AND reason = 'PUBLIC_POOL_CLAIM' AND createdAt >= ${trendStart}
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
      `),
    ])

    const entered = trendMap(enteredRows)
    const claimed = trendMap(claimedRows)
    const trend = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(trendStart.getTime() + index * 24 * 60 * 60 * 1000)
      const key = dateKey(date)
      return { date: key, enterCount: entered.get(key) ?? 0, claimCount: claimed.get(key) ?? 0 }
    })

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total,
          todayAdded,
          weekClaimed,
          avgStayDays: Number(averageRows[0]?.days ?? 0),
        },
        byReason: byReason.map((row) => ({
          reason: row.publicPoolReason ? reasonLabels[row.publicPoolReason] ?? row.publicPoolReason : '未知',
          count: row._count,
        })),
        trend,
      },
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/public-pool/statistics', requestId)
  }
}
