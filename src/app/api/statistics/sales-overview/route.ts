import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'

// GET /api/statistics/sales-overview - 获取销售业绩总览
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (!permissions.includes('report:view') || ability.cannot('read', 'report')) {
      return NextResponse.json({ error: 'No permission to access statistics' }, { status: 403 })
    }

    const now = new Date()
    
    // 时间范围计算
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const whereCondition = await buildDataFilter(session.user.id, session.user.roles)

    // ========== 本月业绩 ==========
    const monthlyRevenueResult = await prisma.order.aggregate({
      where: {
        ...whereCondition,
        createdAt: { gte: monthStart }
      },
      _sum: { contractAmount: true },
      _count: true
    })

    const monthlyRevenue = Number(monthlyRevenueResult._sum.contractAmount || 0)
    const monthlyOrders = monthlyRevenueResult._count

    // 上月业绩(用于环比)
    const lastMonthRevenueResult = await prisma.order.aggregate({
      where: {
        ...whereCondition,
        createdAt: { 
          gte: lastMonthStart,
          lte: lastMonthEnd
        }
      },
      _sum: { contractAmount: true }
    })

    const lastMonthRevenue = Number(lastMonthRevenueResult._sum.contractAmount || 0)
    const revenueGrowth = lastMonthRevenue > 0 
      ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100)
      : 0

    // 本月收款金额
    const monthlyPaymentsResult = await prisma.payment.aggregate({
      where: {
        order: {
          ...whereCondition,
          createdAt: { gte: monthStart }
        }
      },
      _sum: { amount: true }
    })

    const monthlyPayments = Number(monthlyPaymentsResult._sum.amount || 0)

    // 本月新增客户数
    const monthlyNewCustomers = await prisma.customer.count({
      where: {
        ...whereCondition,
        createdAt: { gte: monthStart }
      }
    })

    // ========== 年度累计 ==========
    const yearlyRevenueResult = await prisma.order.aggregate({
      where: {
        ...whereCondition,
        createdAt: { gte: yearStart }
      },
      _sum: { contractAmount: true }
    })

    const yearlyRevenue = Number(yearlyRevenueResult._sum.contractAmount || 0)
    
    // 年度目标(可从配置读取,这里暂时硬编码)
    const yearlyTarget = 1000000
    const targetCompletion = yearlyTarget > 0 
      ? (yearlyRevenue / yearlyTarget * 100)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        monthlyRevenue,
        monthlyOrders,
        monthlyPayments,
        monthlyNewCustomers,
        revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
        yearlyRevenue,
        yearlyTarget,
        targetCompletion: parseFloat(targetCompletion.toFixed(2))
      }
    })
  } catch (error) {
    console.error('Failed to get sales overview:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
