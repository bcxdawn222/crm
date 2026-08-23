import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'
import { parsePagination } from '@/lib/http/pagination'
import { CustomerStatus, OrderStatus, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/finance/orders - Get order list
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'order')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return NextResponse.json({ error: 'Pagination parameters are invalid' }, { status: 400 })
    }
    const { page, pageSize } = pagination
    const keyword = searchParams.get('keyword') || ''
    const status = searchParams.get('status') || ''

    // Build query conditions
    const where: Prisma.OrderWhereInput = {}
    
    // Apply hierarchical data filter based on user role
    const roles = session.user.roles || []
    const dataFilter = await buildDataFilter(session.user.id, roles)
    
    // Sales Manager and Sales can only view their own and subordinates' orders
    if (roles.includes('sales_manager') || roles.includes('sales')) {
      Object.assign(where, dataFilter)
    }
    // Admin and Finance can view all orders

    // Keyword search
    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword } },
        { contractNo: { contains: keyword } },
        { customer: { name: { contains: keyword } } },
      ]
    }

    // Status filter
    if (status) {
      if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
        return NextResponse.json({ error: 'Order status is invalid' }, { status: 400 })
      }
      where.status = status as OrderStatus
    }

    // Query total count
    const total = await prisma.order.count({ where })

    // Query list
    const orders = await prisma.order.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
          }
        },
        sales: {
          select: {
            id: true,
            realName: true,
          }
        },
        _count: {
          select: {
            payments: true,
          }
        }
      }
    })

    // Format Decimal fields
    const formattedOrders = orders.map(order => ({
      ...order,
      contractAmount: order.contractAmount.toNumber(),
      paidAmount: order.paidAmount.toNumber(),
      unpaidAmount: order.unpaidAmount.toNumber(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        list: formattedOrders,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error) {
    console.error('Failed to get order list:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/finance/orders - Create order
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
    if (ability.cannot('create', 'order')) {
      return NextResponse.json({ error: 'No permission to create order' }, { status: 403 })
    }

    const body = await request.json() as {
      customerId?: string
      contractNo?: string
      contractAmount?: number | string
      currency?: string
      signDate?: string
      deliveryDate?: string
      remarks?: string
    }
    const { customerId, contractNo, contractAmount, currency, signDate, deliveryDate, remarks } = body

    // Validate required fields
    if (!customerId || contractAmount === undefined || contractAmount === '' || !signDate) {
      return NextResponse.json({ error: 'Customer, amount and sign date are required' }, { status: 400 })
    }

    const amountNum = Number(contractAmount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Contract amount must be greater than zero' }, { status: 400 })
    }

    const signDateValue = new Date(signDate)
    const deliveryDateValue = deliveryDate ? new Date(deliveryDate) : null
    if (
      Number.isNaN(signDateValue.getTime()) ||
      (deliveryDateValue && Number.isNaN(deliveryDateValue.getTime()))
    ) {
      return NextResponse.json({ error: 'Order date is invalid' }, { status: 400 })
    }

    const supportedCurrencies = ['CNY', 'USD', 'EUR']
    const normalizedCurrency = currency || 'CNY'
    if (!supportedCurrencies.includes(normalizedCurrency)) {
      return NextResponse.json({ error: 'Currency is invalid' }, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, isPublic: true },
    })
    if (!customer || customer.status !== CustomerStatus.ACTIVE) {
      return NextResponse.json({ error: 'Customer not found or inactive' }, { status: 404 })
    }
    if (customer.isPublic) {
      return NextResponse.json({ error: 'No permission to create an order for this customer' }, { status: 403 })
    }

    const customerDataFilter = await buildDataFilter(session.user.id, session.user.roles || [])
    const accessibleCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        status: CustomerStatus.ACTIVE,
        isPublic: false,
        ...customerDataFilter,
      },
      select: { id: true },
    })
    if (!accessibleCustomer) {
      return NextResponse.json({ error: 'No permission to create an order for this customer' }, { status: 403 })
    }

    // Generate order number
    const orderNo = `ORD-${Date.now()}-${randomUUID().slice(0, 8)}`

    // Create order
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNo,
          customerId,
          contractNo,
          contractAmount: amountNum,
          paidAmount: 0,
          unpaidAmount: amountNum,
          signDate: signDateValue,
          deliveryDate: deliveryDateValue,
          currency: normalizedCurrency,
          remarks,
          salesId: session.user.id,
          status: 'CONFIRMED',
        }
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'CREATE',
        entityType: 'Order',
        entityId: created.id,
        afterData: created,
        reason: 'ORDER_CREATED',
        requestId,
      })
      return created
    })

    return jsonWithRequestId({
      success: true,
      data: order,
      message: 'Order created successfully'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/finance/orders', requestId)
  }
}
