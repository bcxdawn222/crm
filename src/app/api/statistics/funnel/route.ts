import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'

// GET /api/statistics/funnel - 获取销售漏斗分析
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

    const userId = session.user.id
    const roles = session.user.roles || []

    // 管理员/主管可以看全部数据,普通销售只看自己的
    const whereCondition = roles.includes('ADMIN') || roles.includes('SALES_MANAGER')
      ? {}
      : { salesId: userId }

    // 获取所有客户
    const customers = await prisma.customer.findMany({
      where: whereCondition,
      include: {
        orders: {
          select: {
            id: true,
            contractAmount: true,
            createdAt: true,
            status: true
          }
        },
        followUps: {
          select: {
            id: true,
            createdAt: true
          }
        }
      }
    })

    const now = new Date()

    // 定义漏斗阶段
    const stages = [
      {
        stage: 'LEAD',
        name: '线索客户',
        filter: (c: any) => c.status === 'ACTIVE' && !c.isPublic
      },
      {
        stage: 'CONTACTED',
        name: '已跟进',
        filter: (c: any) => c.lastFollowUpAt !== null
      },
      {
        stage: 'PROPOSAL',
        name: '有订单',
        filter: (c: any) => c.orders.length > 0
      },
      {
        stage: 'NEGOTIATION',
        name: '待确认',
        filter: (c: any) => c.orders.some((o: any) => o.status === 'PENDING' || o.status === 'CONFIRMED')
      },
      {
        stage: 'CLOSED_WON',
        name: '已成交',
        filter: (c: any) => c.orders.some((o: any) => o.status === 'COMPLETED')
      }
    ]

    // 计算每个阶段的客户数和转化率
    const funnelStages = stages.map((stageDef, index) => {
      const filteredCustomers = customers.filter(stageDef.filter)
      const count = filteredCustomers.length
      
      // 计算转化率(相对于上一阶段)
      let conversionRate = 100
      if (index > 0) {
        const prevCount = customers.filter(stages[index - 1].filter).length
        conversionRate = prevCount > 0 ? (count / prevCount * 100) : 0
      }

      // 计算平均停留天数
      let avgDaysInStage = 0
      if (filteredCustomers.length > 0) {
        const totalDays = filteredCustomers.reduce((sum, c) => {
          const days = (now.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          return sum + days
        }, 0)
        avgDaysInStage = Math.round(totalDays / filteredCustomers.length)
      }

      return {
        stage: stageDef.stage,
        name: stageDef.name,
        count,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        avgDaysInStage
      }
    })

    // 计算整体转化率(线索→成交)
    const leadCount = funnelStages[0]?.count || 0
    const wonCount = funnelStages[stages.length - 1]?.count || 0
    const overallConversionRate = leadCount > 0
      ? Number((wonCount / leadCount * 100).toFixed(2))
      : 0

    // 计算平均销售周期(从创建到成交的平均天数)
    const wonCustomers = customers.filter(c => 
      c.orders.some(o => o.status === 'COMPLETED')
    )
    
    let avgSalesCycle = 0
    if (wonCustomers.length > 0) {
      const totalDays = wonCustomers.reduce((sum, c) => {
        const wonOrder = c.orders.find(o => o.status === 'COMPLETED')
        if (wonOrder) {
          const days = (new Date(wonOrder.createdAt).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          return sum + days
        }
        return sum
      }, 0)
      avgSalesCycle = Math.round(totalDays / wonCustomers.length)
    }

    return NextResponse.json({
      success: true,
      data: {
        stages: funnelStages,
        overallConversionRate,
        avgSalesCycle
      }
    })
  } catch (error) {
    console.error('Failed to get funnel analysis:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
