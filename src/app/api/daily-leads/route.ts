import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { canAccessSalesData, getAccessibleUserIds } from '@/lib/data-permission'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { parsePagination } from '@/lib/http/pagination'
import { queryDailyLeads } from '@/lib/reports/daily-leads'

// GET /api/daily-leads - 获取每日新增客资统计
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
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const salesId = searchParams.get('salesId')
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return NextResponse.json({ error: 'Pagination parameters are invalid' }, { status: 400 })
    }

    // Filter by sales person
    if (salesId) {
      if (!await canAccessSalesData(session.user.id, session.user.roles, salesId)) {
        return NextResponse.json({ error: 'No permission to access this sales scope' }, { status: 403 })
      }
    }
    const result = await queryDailyLeads({
      accessibleUserIds: await getAccessibleUserIds(session.user.id, session.user.roles),
      salesId: salesId || undefined,
      startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined,
      endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
      ...pagination,
    })

    return NextResponse.json({
      success: true,
      data: result.list,
      total: result.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/daily-leads', requestId)
  }
}


