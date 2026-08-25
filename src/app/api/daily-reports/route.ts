import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleUserIds } from '@/lib/data-permission'
import { parsePagination } from '@/lib/http/pagination'
import { Prisma } from '@prisma/client'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/daily-reports - Get daily report list
export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = session.user?.permissions || []
    if (!permissions.includes('report:daily:view')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return NextResponse.json({ error: 'Pagination parameters are invalid' }, { status: 400 })
    }
    const { page, pageSize } = pagination
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    // Build query conditions
    const where: Prisma.DailyReportWhereInput = {}
    
    // Apply hierarchical data filter based on user role
    const accessibleUserIds = await getAccessibleUserIds(session.user.id, session.user.roles)
    if (accessibleUserIds !== null) {
      where.userId = { in: accessibleUserIds }
    }
    // Admin and Finance can view all reports

    // Date range filter
    if (startDate && endDate) {
      where.reportDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const [total, reports] = await Promise.all([
      prisma.dailyReport.count({ where }),
      prisma.dailyReport.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ reportDate: 'desc' }, { id: 'asc' }],
        include: {
          user: { select: { id: true, realName: true } },
          reviewer: { select: { id: true, realName: true } },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        list: reports.map((report) => ({
          ...report,
          authorId: report.userId,
          reviewerId: report.reviewedBy,
          author: report.user,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/daily-reports', requestId)
  }
}

// POST /api/daily-reports - Create daily report
export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    if (!permissions.includes('report:daily:create')) {
      return NextResponse.json({ error: 'No permission to create daily report' }, { status: 403 })
    }

    const body = await request.json()
    const { reportDate, content, tomorrowPlan, issues, attachments } = body

    // Validate required fields
    if (!reportDate || !content) {
      return NextResponse.json({ error: 'Report date and work content are required' }, { status: 400 })
    }

    // Create daily report
    const report = await prisma.dailyReport.create({
      data: {
        reportDate: new Date(reportDate),
        title: `${reportDate} 工作日报`,
        content,
        tomorrowPlan,
        issues,
        attachments,
        userId: session.user.id,
        status: 'SUBMITTED',
      }
    })

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Daily report created successfully'
    })
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/daily-reports', requestId)
  }
}
