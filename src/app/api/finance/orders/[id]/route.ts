import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/finance/orders/[id] - 获取订单详情
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
    if (ability.cannot('read', 'order')) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
            phone: true,
            email: true,
          }
        },
        sales: {
          select: {
            id: true,
            realName: true,
            phone: true,
            email: true,
          }
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            operator: {
              select: {
                realName: true,
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 普通销售只能查看自己的订单
    if (session.user.roles.includes('sales') && order.salesId !== session.user.id) {
      return NextResponse.json({ error: '无权查看该订单' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        contractAmount: order.contractAmount.toNumber(),
        paidAmount: order.paidAmount.toNumber(),
        unpaidAmount: order.unpaidAmount.toNumber(),
        payments: order.payments.map(p => ({
          ...p,
          amount: p.amount.toNumber(),
        }))
      }
    })
  } catch (error) {
    console.error('获取订单详情失败:', error)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}

// PUT /api/finance/orders/[id] - 更新订单
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
    if (ability.cannot('update', 'order')) {
      return NextResponse.json({ error: '无权更新订单' }, { status: 403 })
    }

    const body = await request.json()
    const { contractNo, contractAmount, currency, signDate, deliveryDate, remarks, status } = body

    // 检查订单是否存在
    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id }
    })

    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 普通销售只能修改自己的订单
    if (session.user.roles.includes('sales') && existingOrder.salesId !== session.user.id) {
      return NextResponse.json({ error: '无权修改该订单' }, { status: 403 })
    }

    // 如果更新了合同金额,需要重新计算未付金额
    let updateData: any = {
      contractNo,
      currency,
      signDate: signDate ? new Date(signDate) : null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      remarks,
      status,
    }

    if (contractAmount && contractAmount !== existingOrder.contractAmount.toString()) {
      const newContractAmount = parseFloat(contractAmount)
      const paidAmount = existingOrder.paidAmount.toNumber()
      const newUnpaidAmount = newContractAmount - paidAmount
      
      updateData.contractAmount = newContractAmount
      updateData.unpaidAmount = Math.max(0, newUnpaidAmount)
    }

    // 更新订单
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: params.id },
        data: updateData,
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'UPDATE',
        entityType: 'Order',
        entityId: updated.id,
        beforeData: existingOrder,
        afterData: updated,
        reason: 'ORDER_UPDATED',
        requestId,
      })
      return updated
    })

    return jsonWithRequestId({
      success: true,
      data: {
        ...order,
        contractAmount: order.contractAmount.toNumber(),
        paidAmount: order.paidAmount.toNumber(),
        unpaidAmount: order.unpaidAmount.toNumber(),
      },
      message: '订单更新成功'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'PUT /api/finance/orders/[id]', requestId)
  }
}

// DELETE /api/finance/orders/[id] - 删除订单
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
    if (ability.cannot('delete', 'order')) {
      return NextResponse.json({ error: '无权删除订单' }, { status: 403 })
    }

    // 检查订单是否存在
    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { payments: true }
        }
      }
    })

    if (!existingOrder) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 如果有收款记录,不允许删除
    if (existingOrder._count.payments > 0) {
      return NextResponse.json({ error: '该订单已有收款记录,无法删除' }, { status: 400 })
    }

    // 普通销售只能删除自己的订单
    if (session.user.roles.includes('sales') && existingOrder.salesId !== session.user.id) {
      return NextResponse.json({ error: '无权删除该订单' }, { status: 403 })
    }

    // 删除订单
    await prisma.$transaction(async (tx) => {
      await tx.order.delete({ where: { id: params.id } })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'DELETE',
        entityType: 'Order',
        entityId: existingOrder.id,
        beforeData: existingOrder,
        reason: 'ORDER_DELETED',
        requestId,
      })
    })

    return jsonWithRequestId({
      success: true,
      message: '订单删除成功'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'DELETE /api/finance/orders/[id]', requestId)
  }
}
