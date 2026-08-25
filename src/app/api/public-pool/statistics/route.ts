import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/public-pool/statistics - 获取公海池统计数据
export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'customer')) {
      return NextResponse.json({ error: 'No permission to access statistics' }, { status: 403 })
    }

    const now = new Date()
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // 基础统计
    const total = await prisma.customer.count({
      where: { isPublic: true }
    })

    const todayAdded = await prisma.customer.count({
      where: {
        isPublic: true,
        publicPoolEnteredAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })

    const weekClaimed = await prisma.customer.count({
      where: {
        publicPoolHistory: {
          array_contains: [{
            type: 'CLAIMED'
          }]
        },
        updatedAt: {
          gte: startOfWeek
        }
      }
    })

    // 平均停留时间(天)
    const avgStayResult = await prisma.customer.findMany({
      where: {
        isPublic: true,
        publicPoolEnteredAt: { not: null }
      },
      select: {
        publicPoolEnteredAt: true
      }
    })

    let avgStayDays = 0
    if (avgStayResult.length > 0) {
      const totalDays = avgStayResult.reduce((sum, c) => {
        if (c.publicPoolEnteredAt) {
          return sum + (now.getTime() - new Date(c.publicPoolEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
        }
        return sum
      }, 0)
      avgStayDays = Math.round(totalDays / avgStayResult.length)
    }

    // 按进入原因分类统计
    const byReason = await prisma.customer.groupBy({
      by: ['publicPoolReason'],
      where: { isPublic: true },
      _count: true,
      orderBy: {
        _count: {
          publicPoolReason: 'desc'
        }
      }
    })

    const reasonMap: Record<string, string> = {
      'RULE_1': '长期未跟进(90天)',
      'RULE_2': '创建后未跟进(30天)',
      'RULE_3': '合同到期未续签',
      'RULE_4': '客户已失效',
      'RULE_5': '多次跟进无进展',
      'AUTO_RECYCLE': '超期自动回收',
      null: '未知'
    }

    // 近30天趋势数据
    const trendData = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dayStart = new Date(date.setHours(0, 0, 0, 0))
      const dayEnd = new Date(date.setHours(23, 59, 59, 999))

      const enterCount = await prisma.customer.count({
        where: {
          isPublic: true,
          publicPoolEnteredAt: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      })

      // 统计当天认领的数量(通过publicPoolHistory)
      const customersWithHistory = await prisma.customer.findMany({
        where: {
          publicPoolHistory: {
            path: '$[*].claimedAt',
            array_contains: [dayStart.toISOString()]
          }
        },
        select: {
          publicPoolHistory: true
        }
      })

      let claimCount = 0
      customersWithHistory.forEach(c => {
        if (c.publicPoolHistory && Array.isArray(c.publicPoolHistory)) {
          claimCount += (c.publicPoolHistory as any[]).filter((h: any) => 
            h.type === 'CLAIMED' && 
            new Date(h.claimedAt) >= dayStart && 
            new Date(h.claimedAt) <= dayEnd
          ).length
        }
      })

      trendData.push({
        date: date.toISOString().split('T')[0],
        enterCount,
        claimCount
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total,
          todayAdded,
          weekClaimed,
          avgStayDays
        },
        byReason: byReason.map(r => ({
          reason: reasonMap[r.publicPoolReason as string] || r.publicPoolReason || '未知',
          count: r._count
        })),
        trend: trendData
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/public-pool/statistics', requestId)
  }
}
