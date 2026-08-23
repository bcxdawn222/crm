import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { getUserAndSubordinateIds } from '@/lib/data-permission'
import { Prisma } from '@prisma/client'

// GET /api/daily-reports - Get daily report list
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - all roles can view reports now
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'report')) {
      // Finance role doesn't have report:view permission, but we allow them to view
      const userRoles = session.user?.roles || []
      if (!userRoles.includes('finance')) {
        return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    // Build query conditions
    const where: Prisma.DailyReportWhereInput = {}
    
    // Apply hierarchical data filter based on user role
    const userRoles = session.user?.roles || []
    if (userRoles.includes('sales_manager') || userRoles.includes('sales')) {
      where.userId = { in: await getUserAndSubordinateIds(session.user.id) }
    }
    // Admin and Finance can view all reports

    // Date range filter
    if (startDate && endDate) {
      where.reportDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    // Query total count
    const total = await prisma.dailyReport.count({ where })

    // Query list
    const reports = await prisma.dailyReport.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { reportDate: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            realName: true,
          }
        },
        reviewer: {
          select: {
            id: true,
            realName: true,
          },
        },
      }
    })

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
    console.error('Failed to get daily report list:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/daily-reports - Create daily report
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('create', 'report')) {
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
    console.error('Failed to create daily report:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
