import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { InvoiceType, PaymentMethod } from '@prisma/client'
import { z } from 'zod'
import { createPayment, CreatePaymentError } from '@/lib/payments/create'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'


const createPaymentSchema = z.object({
  orderId: z.string().uuid('订单 ID 格式不正确'),
  amount: z.coerce.number().positive('收款金额必须大于 0').max(99_999_999.99),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paymentDate: z.coerce.date(),
  invoiceNo: z.string().trim().max(50).optional(),
  invoiceType: z.nativeEnum(InvoiceType).optional(),
  remarks: z.string().trim().max(500).optional(),
})

// GET /api/finance/payments - Get payment list
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'payment')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const keyword = searchParams.get('keyword') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    // Build query conditions
    const where: any = {}
    
    // Sales can only view their own payments
    if (session.user.roles.includes('sales')) {
      where.order = {
        salesId: session.user.id
      }
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { paymentNo: { contains: keyword } },
        { invoiceNo: { contains: keyword } },
      ]
    }

    // Date range filter
    if (startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    // Query total count
    const total = await prisma.payment.count({ where })

    // Query list
    const payments = await prisma.payment.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { paymentDate: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
            contractAmount: true,
            customer: {
              select: {
                name: true,
                company: true,
              }
            }
          }
        },
        operator: {
          select: {
            id: true,
            realName: true,
          }
        }
      }
    })

    // Format Decimal fields
    const formattedPayments = payments.map(payment => ({
      ...payment,
      amount: payment.amount.toNumber(),
      order: {
        ...payment.order,
        contractAmount: payment.order.contractAmount.toNumber(),
      }
    }))

    return NextResponse.json({
      success: true,
      data: {
        list: formattedPayments,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error) {
    console.error('Failed to get payment list:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/finance/payments - Create payment
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
    if (ability.cannot('create', 'payment')) {
      return NextResponse.json({ error: 'No permission to create payment' }, { status: 403 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: '请求内容不是有效 JSON' }, { status: 400 })
    }
    const parsed = createPaymentSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '收款参数不正确' },
        { status: 400 }
      )
    }

    const payment = await createPayment({
      ...parsed.data,
      operatorId: session.user.id,
      requestId,
    })

    return jsonWithRequestId({
      success: true,
      data: payment,
      message: 'Payment created successfully'
    }, requestId)
  } catch (error) {
    if (error instanceof CreatePaymentError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'POST /api/finance/payments', requestId)
  }
}
