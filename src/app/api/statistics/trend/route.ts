import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'

// GET /api/statistics/trend - 获取业绩趋势分析
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'report')) {
      return NextResponse.json({ error: 'No permission to access statistics' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // 7d, 30d, 90d, ytd
    const granularity = searchParams.get('granularity') || 'day' // day, week, month

    const userId = session.user.id
    const roles = session.user.roles || []
    const now = new Date()

    // 管理员/主管可以看全部数据,普通销售只看自己的
    const whereCondition = roles.includes('ADMIN') || roles.includes('SALES_MANAGER')
      ? {}
      : { salesId: userId }

    // 计算时间范围
    let startDate: Date
    let groupBy: 'day' | 'week' | 'month'
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        groupBy = 'day'
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        groupBy = 'day'
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        groupBy = 'week'
        break
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1)
        groupBy = 'month'
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        groupBy = 'day'
    }

    // 生成日期序列
    const dateSequence: string[] = []
    const currentDate = new Date(startDate)
    
    while (currentDate <= now) {
      if (groupBy === 'day') {
        dateSequence.push(currentDate.toISOString().split('T')[0])
        currentDate.setDate(currentDate.getDate() + 1)
      } else if (groupBy === 'week') {
        dateSequence.push(`${currentDate.getFullYear()}-W${Math.ceil((currentDate.getDate() + 6) / 7)}`)
        currentDate.setDate(currentDate.getDate() + 7)
      } else {
        dateSequence.push(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`)
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
    }

    // 获取订单数据
    const orders = await prisma.order.findMany({
      where: {
        ...whereCondition,
        createdAt: { gte: startDate }
      },
      select: {
        id: true,
        contractAmount: true,
        createdAt: true,
        customerId: true
      }
    })

    // 获取客户数据
    const customers = await prisma.customer.findMany({
      where: {
        ...whereCondition,
        createdAt: { gte: startDate }
      },
      select: {
        id: true,
        createdAt: true
      }
    })

    // 获取跟进记录
    const followUps = await prisma.followUp.findMany({
      where: {
        salesId: userId,
        createdAt: { gte: startDate }
      },
      select: {
        id: true,
        createdAt: true
      }
    })

    // 按日期分组统计
    const trendData = dateSequence.map(date => {
      let periodStart: Date
      let periodEnd: Date

      if (groupBy === 'day') {
        periodStart = new Date(date)
        periodEnd = new Date(date)
        periodEnd.setHours(23, 59, 59, 999)
      } else if (groupBy === 'week') {
        const [year, week] = date.split('-W').map(Number)
        const jan1 = new Date(year, 0, 1)
        const daysOffset = (week - 1) * 7
        periodStart = new Date(jan1.getTime() + daysOffset * 24 * 60 * 60 * 1000)
        periodEnd = new Date(periodStart.getTime() + 6 * 24 * 60 * 60 * 1000)
        periodEnd.setHours(23, 59, 59, 999)
      } else {
        const [year, month] = date.split('-').map(Number)
        periodStart = new Date(year, month - 1, 1)
        periodEnd = new Date(year, month, 0, 23, 59, 59, 999)
      }

      // 统计该时间段的订单金额
      const periodOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt)
        return orderDate >= periodStart && orderDate <= periodEnd
      })

      const revenue = periodOrders.reduce((sum, o) => sum + Number(o.contractAmount), 0)

      // 统计该时间段的新增客户
      const periodCustomers = customers.filter(c => {
        const customerDate = new Date(c.createdAt)
        return customerDate >= periodStart && customerDate <= periodEnd
      })

      // 统计该时间段的跟进次数
      const periodFollowUps = followUps.filter(f => {
        const followUpDate = new Date(f.createdAt)
        return followUpDate >= periodStart && followUpDate <= periodEnd
      })

      return {
        date,
        revenue,
        orders: periodOrders.length,
        newCustomers: periodCustomers.length,
        followUps: periodFollowUps.length
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        period,
        granularity: groupBy,
        dataPoints: trendData
      }
    })
  } catch (error) {
    console.error('Failed to get trend analysis:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
