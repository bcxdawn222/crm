import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { CustomerLevel, CustomerSource, CustomerStatus } from '@prisma/client'
import { recordAuditEvent } from '@/lib/audit/record'
import { canAccessSalesData } from '@/lib/data-permission'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

class CustomerRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'CustomerRouteError'
  }
}

// GET /api/customers/[id] - 获取客户详情
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'customer')) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        sales: {
          select: {
            id: true,
            realName: true,
            phone: true,
            email: true,
          }
        },
        followUps: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            sales: {
              select: {
                id: true,
                realName: true,
              }
            }
          }
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        leads: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: '客户不存在' }, { status: 404 })
    }

    if (!await canAccessSalesData(session.user.id, session.user.roles, customer.salesId)) {
      return NextResponse.json({ error: '无权查看该客户' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: customer
    })
  } catch (error) {
    console.error('获取客户详情失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

// PUT /api/customers/[id] - 更新客户
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查权限
    const ability = defineAbility(session.user.permissions as string[])
    if (ability.cannot('update', 'customer')) {
      return NextResponse.json({ error: '无权更新客户' }, { status: 403 })
    }

    const body = await request.json()
    const { name, company, phone, email, address, category, source, notes, status } = body

    // 验证必填字段
    if (!name || !phone) {
      return NextResponse.json({ error: '姓名和电话为必填项' }, { status: 400 })
    }

    // 检查客户是否存在
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id }
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: '客户不存在' }, { status: 404 })
    }

    if (!await canAccessSalesData(session.user.id, session.user.roles, existingCustomer.salesId)) {
      return NextResponse.json({ error: '无权修改该客户' }, { status: 403 })
    }

    // 检查电话是否与其他客户重复
    const duplicatePhone = await prisma.customer.findFirst({
      where: {
        phone,
        id: { not: params.id }
      }
    })

    if (duplicatePhone) {
      return NextResponse.json({ error: '该电话已被其他客户使用' }, { status: 400 })
    }

    // 将category映射为level
    const categoryMap: Record<string, CustomerLevel> = {
      '潜在客户': 'POTENTIAL',
      '普通客户': 'NORMAL',
      '重要客户': 'IMPORTANT',
      'VIP客户': 'VIP',
    }

    // 更新客户
    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: params.id },
        data: {
          name,
          company,
          phone,
          email,
          address,
          level: category ? (categoryMap[category] || existingCustomer.level) : existingCustomer.level,
          source: Object.values(CustomerSource).includes(source as CustomerSource)
            ? source as CustomerSource
            : existingCustomer.source,
          notes,
          status: Object.values(CustomerStatus).includes(status as CustomerStatus)
            ? status as CustomerStatus
            : existingCustomer.status,
        }
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'UPDATE',
        entityType: 'Customer',
        entityId: updated.id,
        beforeData: existingCustomer,
        afterData: updated,
        reason: 'CUSTOMER_UPDATED',
        requestId,
      })
      return updated
    })

    return jsonWithRequestId({
      success: true,
      data: customer,
      message: '客户更新成功'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'PUT /api/customers/[id]', requestId)
  }
}

// DELETE /api/customers/[id] - 删除客户
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查权限
    const ability = defineAbility(session.user.permissions as string[])
    if (ability.cannot('delete', 'customer')) {
      return NextResponse.json({ error: '无权删除客户' }, { status: 403 })
    }

    // 检查客户是否存在
    const customer = await prisma.customer.findUnique({
      where: { id: params.id }
    })

    if (!customer) {
      return NextResponse.json({ error: '客户不存在' }, { status: 404 })
    }

    if (!await canAccessSalesData(session.user.id, session.user.roles, customer.salesId)) {
      return NextResponse.json({ error: '无权删除该客户' }, { status: 403 })
    }

    if (customer.status === 'INACTIVE') {
      return jsonWithRequestId(
        { error: '客户已删除', code: 'CUSTOMER_ALREADY_INACTIVE' },
        requestId,
        { status: 409 }
      )
    }

    // 软删除(设置状态为INACTIVE)
    const updatedCustomer = await prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({
        where: { id: params.id, status: { not: 'INACTIVE' } },
        data: { status: 'INACTIVE' }
      })
      if (result.count !== 1) {
        throw new CustomerRouteError(
          '客户状态已变化，请刷新后重试',
          409,
          'CUSTOMER_DELETE_CONFLICT'
        )
      }
      const updated = await tx.customer.findUnique({ where: { id: params.id } })
      if (!updated) {
        throw new CustomerRouteError('客户删除结果不存在', 500, 'CUSTOMER_DELETE_RESULT_MISSING')
      }
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'DELETE',
        entityType: 'Customer',
        entityId: updated.id,
        beforeData: customer,
        afterData: updated,
        reason: 'CUSTOMER_SOFT_DELETED',
        requestId,
      })
      return updated
    })

    return jsonWithRequestId({
      success: true,
      message: '客户删除成功'
    }, requestId)
  } catch (error) {
    if (error instanceof CustomerRouteError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'DELETE /api/customers/[id]', requestId)
  }
}
