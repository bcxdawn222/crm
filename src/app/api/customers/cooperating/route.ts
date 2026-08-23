import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'

// GET /api/customers/cooperating - 获取已合作客户列表
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
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const keyword = searchParams.get('keyword')
    const expiringSoon = searchParams.get('expiringSoon') === 'true'

    // Build query conditions
    const where: any = {
      status: 'COOPERATING',
      salesId: session.user.id
    }

    // Filter by expiring contracts
    if (expiringSoon) {
      const today = new Date()
      const reminderDate = new Date()
      reminderDate.setDate(today.getDate() + 30) // Default 30 days
      
      where.contractEndDate = {
        lte: reminderDate,
        gte: today
      }
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { company: { contains: keyword } },
        { contactPerson: { contains: keyword } },
      ]
    }

    // Query total count
    const total = await prisma.customer.count({ where })

    // Query list
    const customers = await prisma.customer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { contractEndDate: 'asc' },
      include: {
        sales: {
          select: {
            id: true,
            realName: true,
          }
        },
        operationManager: {
          select: {
            id: true,
            realName: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        list: customers,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error: any) {
    console.error('Failed to get cooperating customers:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}

// PUT /api/customers/cooperating - 更新已合作客户信息
export async function PUT(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    // Check ownership
    const customer = await prisma.customer.findUnique({
      where: { id }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer.salesId !== session.user.id) {
      return NextResponse.json({ error: 'No permission to update this customer' }, { status: 403 })
    }

    const body = await request.json()
    const {
      contractStartDate,
      contractEndDate,
      contractAmount,
      renewalReminderDays,
      lastVisitAt,
      nextVisitAt,
      visitFrequency,
      cooperationNotes,
      operationManagerId,
    } = body

    // Update customer
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        contractStartDate: contractStartDate ? new Date(contractStartDate) : undefined,
        contractEndDate: contractEndDate ? new Date(contractEndDate) : undefined,
        contractAmount: contractAmount ? parseFloat(contractAmount) : undefined,
        renewalReminderDays,
        lastVisitAt: lastVisitAt ? new Date(lastVisitAt) : undefined,
        nextVisitAt: nextVisitAt ? new Date(nextVisitAt) : undefined,
        visitFrequency,
        cooperationNotes,
        operationManagerId,
      }
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Cooperating customer updated successfully'
    })
  } catch (error: any) {
    console.error('Failed to update cooperating customer:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}

// POST /api/customers/mark-cooperating - 标记客户为已合作
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customerId, contractStartDate, contractEndDate, contractAmount } = body

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    // Check ownership
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer.salesId !== session.user.id) {
      return NextResponse.json({ error: 'No permission to update this customer' }, { status: 403 })
    }

    // Update customer status to COOPERATING
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        status: 'COOPERATING',
        contractStartDate: contractStartDate ? new Date(contractStartDate) : undefined,
        contractEndDate: contractEndDate ? new Date(contractEndDate) : undefined,
        contractAmount: contractAmount ? parseFloat(contractAmount) : undefined,
      }
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Customer marked as cooperating successfully'
    })
  } catch (error: any) {
    console.error('Failed to mark customer as cooperating:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}

