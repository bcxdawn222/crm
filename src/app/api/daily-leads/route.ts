import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { canAccessSalesData, getAccessibleUserIds } from '@/lib/data-permission'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { parsePagination } from '@/lib/http/pagination'
import { queryDailyLeads } from '@/lib/reports/daily-leads'
import { parseDateRangeQuery } from '@/lib/http/date-validation'

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
    const salesId = searchParams.get('salesId')
    const dateRange = parseDateRangeQuery(searchParams)
    if (!dateRange.success) {
      return NextResponse.json({ error: dateRange.error }, { status: 400 })
    }
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
      startDate: dateRange.data?.startDate,
      endDate: dateRange.data?.endDate,
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


