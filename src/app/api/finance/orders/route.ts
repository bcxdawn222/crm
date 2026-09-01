import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'
import { parsePagination } from '@/lib/http/pagination'
import { OrderStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { createOrder, CreateOrderError } from '@/lib/orders/create'
import { checkOrderEligibility } from '@/lib/customers/order-eligibility'

const createOrderSchema = z.object({
  customerId: z.string().uuid('客户 ID 格式不正确').optional(),
  contractNo: z.string().trim().max(50).optional(),
  contractAmount: z.coerce.number().min(0, '合同金额不能小于 0').max(99_999_999.99).default(0),
  currency: z.enum(['CNY', 'USD', 'EUR']).default('CNY'),
  signDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional(),
  remarks: z.string().trim().max(10_000).optional(),
}).refine(
  (data) => !data.deliveryDate || !data.signDate || data.deliveryDate >= data.signDate,
  '交付日期不能早于签约日期'
)

// GET /api/finance/orders - Get order list
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
    
    Object.assign(where, dataFilter)

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
    return serverErrorResponse(error, 'GET /api/finance/orders', requestId)
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

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON', requestId }, requestId, { status: 400 })
    }
    const parsed = createOrderSchema.safeParse(payload)
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message ?? '订单参数不正确', requestId },
        requestId,
        { status: 400 }
      )
    }
    const { customerId } = parsed.data
    if (!customerId) {
      return jsonWithRequestId({ error: '请选择客户后再创建订单', requestId }, requestId, { status: 400 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, status: true, isPublic: true, salesId: true },
    })
    if (!customer) {
      return jsonWithRequestId({ error: '客户不存在', code: 'CUSTOMER_NOT_FOUND' }, requestId, { status: 404 })
    }
    const eligibilityError = await checkOrderEligibility(session.user.id, session.user.roles || [], customer)
    if (eligibilityError) {
      return jsonWithRequestId({ error: eligibilityError, code: 'CUSTOMER_NOT_ORDER_ELIGIBLE' }, requestId, { status: 403 })
    }

    const { order, replayed } = await createOrder({
      ...parsed.data,
      customerId,
      salesId: customer.salesId,
      actorId: session.user.id,
      requestId,
    })

    return jsonWithRequestId({
      success: true,
      data: order,
      replayed,
      message: replayed ? '订单已存在，返回原记录' : 'Order created successfully'
    }, requestId, { status: replayed ? 200 : 201 })
  } catch (error) {
    if (error instanceof CreateOrderError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code, requestId },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'POST /api/finance/orders', requestId)
  }
}
