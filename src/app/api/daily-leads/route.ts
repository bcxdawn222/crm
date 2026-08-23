import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'

// GET /api/daily-leads - 获取每日新增客资统计
export async function GET(request: Request) {
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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')

    // Build date filter
    const where: any = {}
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z')
      }
    }

    // Filter by sales person
    if (salesId) {
      where.salesId = salesId
    } else {
      const userRoles = session.user?.roles || []
      if (userRoles.includes('sales')) {
        // Sales can only view their own data
        where.salesId = session.user.id
      }
    }

    // Get daily statistics
    const dailyStats = await getDailyLeadStats(where, page, pageSize)

    // Get total count of unique dates
    const allCustomers = await prisma.customer.findMany({
      where,
      select: {
        createdAt: true
      }
    })
    
    const uniqueDates = new Set(
      allCustomers.map(c => c.createdAt.toISOString().split('T')[0])
    )
    const total = uniqueDates.size

    return NextResponse.json({
      success: true,
      data: dailyStats,
      total,
      page,
      pageSize
    })
  } catch (error: any) {
    console.error('Failed to get daily leads:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}

// Helper function to get daily lead statistics
async function getDailyLeadStats(where: any, page: number, pageSize: number) {
  const skip = (page - 1) * pageSize
  
  // Get customers grouped by date
  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      email: true,
      level: true,
      source: true,
      notes: true,
      isPublic: true,
      createdAt: true,
      sales: {
        select: {
          id: true,
          realName: true,
          username: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Group by date
  const groupedByDate: Record<string, any[]> = {}
  customers.forEach(customer => {
    const dateKey = customer.createdAt.toISOString().split('T')[0]
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = []
    }
    groupedByDate[dateKey].push(customer)
  })

  // Convert to array and paginate
  const allDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))
  const paginatedDates = allDates.slice(skip, skip + pageSize)
  
  const result = paginatedDates.map(date => {
    const dayCustomers = groupedByDate[date]
    return {
      date,
      count: dayCustomers.length,
      customers: dayCustomers,
      // Statistics by level
      byLevel: {
        POTENTIAL: dayCustomers.filter(c => c.level === 'POTENTIAL').length,
        NORMAL: dayCustomers.filter(c => c.level === 'NORMAL').length,
        IMPORTANT: dayCustomers.filter(c => c.level === 'IMPORTANT').length,
        VIP: dayCustomers.filter(c => c.level === 'VIP').length,
      },
      // Statistics by source
      bySource: dayCustomers.reduce((acc, curr) => {
        const source = curr.source || 'OTHER'
        acc[source] = (acc[source] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  })

  return result
}


