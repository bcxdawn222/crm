import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { Prisma } from '@prisma/client'
import { buildDataFilter } from '@/lib/data-permission'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/finance/reports/summary - Get financial summary
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
    if (!permissions.includes('report:view') || ability.cannot('read', 'report')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    // Build query conditions
    const where: Prisma.OrderWhereInput = {
      ...await buildDataFilter(session.user.id, session.user.roles),
    }

    // Date range filter
    if (startDate && endDate) {
      where.signDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const summary = await prisma.order.aggregate({
      where,
      _count: true,
      _sum: { contractAmount: true, paidAmount: true, unpaidAmount: true },
    })

    const totalOrders = summary._count
    const totalAmount = Number(summary._sum.contractAmount ?? 0)
    const paidAmount = Number(summary._sum.paidAmount ?? 0)
    const unpaidAmount = Number(summary._sum.unpaidAmount ?? 0)
    const completionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        totalAmount,
        paidAmount,
        unpaidAmount,
        completionRate,
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/finance/reports/summary', requestId)
  }
}
