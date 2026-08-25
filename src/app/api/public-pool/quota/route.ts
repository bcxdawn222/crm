import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/public-pool/quota - 获取用户公海池认领配额状态
export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // 获取用户配额配置
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        maxActiveCustomers: true,
        maxDailyClaims: true,
        claimHoldDays: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 管理员无限制
    if (session.user.roles.includes('admin')) {
      return NextResponse.json({
        success: true,
        data: {
          quota: {
            maxActiveCustomers: user.maxActiveCustomers,
            maxDailyClaims: user.maxDailyClaims,
            claimHoldDays: user.claimHoldDays
          },
          usage: {
            activeCount: 0,
            todayClaims: 0
          },
          canClaim: true,
          isAdmin: true
        }
      })
    }

    // 计算当前活跃客户数
    const activeCount = await prisma.customer.count({
      where: {
        salesId: userId,
        isPublic: false,
        status: 'ACTIVE'
      }
    })

    // 计算今日认领次数
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const todayClaims = await prisma.customer.count({
      where: {
        salesId: userId,
        isPublic: false,
        publicPoolEnteredAt: { gte: startOfDay }
      }
    })

    // 判断是否可以认领
    const canClaim = activeCount < user.maxActiveCustomers && 
                     todayClaims < user.maxDailyClaims

    return NextResponse.json({
      success: true,
      data: {
        quota: {
          maxActiveCustomers: user.maxActiveCustomers,
          maxDailyClaims: user.maxDailyClaims,
          claimHoldDays: user.claimHoldDays
        },
        usage: {
          activeCount,
          todayClaims
        },
        canClaim,
        isAdmin: false
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/public-pool/quota', requestId)
  }
}
