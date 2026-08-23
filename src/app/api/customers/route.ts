import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'
import { parsePagination } from '@/lib/http/pagination'
import { CustomerLevel, CustomerSource, CustomerStatus, Prisma } from '@prisma/client'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/customers - Get customer list
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 })
    }

    // Check permissions
    const permissions = (session.user?.permissions as string[]) || []
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json({ error: '当前账号未配置客户查看权限' }, { status: 403 })
    }
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'customer')) {
      return NextResponse.json({ error: '无权查看客户信息' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return NextResponse.json({ error: 'Pagination parameters are invalid' }, { status: 400 })
    }
    const { page, pageSize } = pagination
    const keyword = searchParams.get('keyword') || ''
    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''
    const publicPool = searchParams.get('publicPool') === 'true'

    // Build query conditions
    const where: Prisma.CustomerWhereInput = {}
    
    // If querying public pool
    if (publicPool) {
      where.isPublic = true
    } else {
      // Apply hierarchical data filter based on user role
      const roles = session.user.roles || []
      const dataFilter = await buildDataFilter(session.user.id, roles)
      
      // Sales Manager and Sales can only view their own and subordinates' customers
      if (roles.includes('sales_manager') || roles.includes('sales')) {
        Object.assign(where, dataFilter)
        where.isPublic = false
      }
      // Admin and Finance can view all non-public customers (no filter applied)
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { company: { contains: keyword } },
        { phone: { contains: keyword } },
        { email: { contains: keyword } },
      ]
    }

    // Category filter (level field)
    if (category) {
      const levelMap: Record<string, CustomerLevel> = {
        '潜在客户': 'POTENTIAL',
        '普通客户': 'NORMAL',
        '重要客户': 'IMPORTANT',
        'VIP客户': 'VIP',
      }
      where.level = levelMap[category] || category
    }

    // Status filter
    if (status) {
      if (!Object.values(CustomerStatus).includes(status as CustomerStatus)) {
        return NextResponse.json({ error: 'Customer status is invalid' }, { status: 400 })
      }
      where.status = status as CustomerStatus
    }

    // Query total count
    const total = await prisma.customer.count({ where })

    // Query list
    const customers = await prisma.customer.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        sales: {
          select: {
            id: true,
            realName: true,
          }
        },
        _count: {
          select: {
            followUps: true,
            orders: true,
          }
        },
        followUps: {
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        }
      }
    })

    // Map level to category
    const levelMap: Record<string, string> = {
      'POTENTIAL': '潜在客户',
      'NORMAL': '普通客户',
      'IMPORTANT': '重要客户',
      'VIP': 'VIP客户',
    }

    const listWithCategory = customers.map(c => ({
      ...c,
      category: levelMap[c.level as string] || c.level,
    }))

    return NextResponse.json({
      success: true,
      data: {
        list: listWithCategory,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error) {
    console.error('Failed to get customer list:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/customers - Create customer
export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('create', 'customer')) {
      return NextResponse.json({ error: 'No permission to create customer' }, { status: 403 })
    }

    const body = await request.json()
    const { name, company, phone, email, address, category, source, notes } = body

    // Validate required fields
    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    // Check if already exists
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone },
          ...(email ? [{ email }] : []),
        ]
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Customer already exists' }, { status: 400 })
    }

    // Map category to level
    const categoryMap: Record<string, CustomerLevel> = {
      '潜在客户': 'POTENTIAL',
      '普通客户': 'NORMAL',
      '重要客户': 'IMPORTANT',
      'VIP客户': 'VIP',
    }

    // Create customer
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name,
          company,
          phone,
          email,
          address,
          level: categoryMap[category] || 'POTENTIAL',
          source: Object.values(CustomerSource).includes(source as CustomerSource)
            ? source as CustomerSource
            : CustomerSource.OTHER,
          notes,
          salesId: session.user.id,
          isPublic: false,
          status: 'ACTIVE',
        }
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'CREATE',
        entityType: 'Customer',
        entityId: created.id,
        afterData: created,
        reason: 'CUSTOMER_CREATED',
        requestId,
      })
      return created
    })

    return jsonWithRequestId({
      success: true,
      data: customer,
      message: 'Customer created successfully'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/customers', requestId)
  }
}
