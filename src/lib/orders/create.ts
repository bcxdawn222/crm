import { randomUUID } from 'crypto'

import { Prisma } from '@prisma/client'

import { recordAuditEvent } from '@/lib/audit/record'
import { prisma } from '@/lib/prisma'

export interface CreateOrderInput {
  customerId: string
  contractNo?: string
  contractAmount: number
  currency: string
  signDate: Date
  deliveryDate?: Date
  remarks?: string
  salesId: string
  requestId: string
}

export class CreateOrderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'CreateOrderError'
  }
}

function sameDate(left: Date | null, right?: Date): boolean {
  return left?.getTime() === right?.getTime() || (!left && !right)
}

function matchesInput(order: {
  customerId: string
  salesId: string
  contractNo: string | null
  contractAmount: Prisma.Decimal
  currency: string
  signDate: Date | null
  deliveryDate: Date | null
  remarks: string | null
}, input: CreateOrderInput): boolean {
  return order.customerId === input.customerId
    && order.salesId === input.salesId
    && order.contractNo === (input.contractNo || null)
    && order.contractAmount.equals(input.contractAmount)
    && order.currency === input.currency
    && sameDate(order.signDate, input.signDate)
    && sameDate(order.deliveryDate, input.deliveryDate)
    && order.remarks === (input.remarks || null)
}

async function replayForRequest(input: CreateOrderInput) {
  const existing = await prisma.order.findUnique({ where: { requestId: input.requestId } })
  if (!existing) return null
  if (!matchesInput(existing, input)) {
    throw new CreateOrderError('请求号已用于另一笔订单', 409, 'ORDER_REQUEST_CONFLICT')
  }
  return existing
}

export async function createOrder(input: CreateOrderInput) {
  const replay = await replayForRequest(input)
  if (replay) return { order: replay, replayed: true }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { requestId: input.requestId } })
      if (existing) {
        if (!matchesInput(existing, input)) {
          throw new CreateOrderError('请求号已用于另一笔订单', 409, 'ORDER_REQUEST_CONFLICT')
        }
        return existing
      }

      const amount = new Prisma.Decimal(input.contractAmount.toFixed(2))
      const created = await tx.order.create({
        data: {
          orderNo: `ORD-${Date.now()}-${randomUUID().slice(0, 8)}`,
          requestId: input.requestId,
          customerId: input.customerId,
          contractNo: input.contractNo || null,
          contractAmount: amount,
          paidAmount: 0,
          unpaidAmount: amount,
          signDate: input.signDate,
          deliveryDate: input.deliveryDate || null,
          currency: input.currency,
          remarks: input.remarks || null,
          salesId: input.salesId,
          status: 'CONFIRMED',
        },
      })
      await recordAuditEvent(tx, {
        actorId: input.salesId,
        action: 'CREATE',
        entityType: 'Order',
        entityId: created.id,
        afterData: created,
        reason: 'ORDER_CREATED',
        requestId: input.requestId,
      })
      return created
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { order, replayed: false }
  } catch (error) {
    if (error instanceof CreateOrderError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await replayForRequest(input)
      if (existing) return { order: existing, replayed: true }
      throw new CreateOrderError('订单正在创建，请刷新后重试', 409, 'ORDER_CONFLICT')
    }
    throw error
  }
}
