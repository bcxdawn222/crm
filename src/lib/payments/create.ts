import { randomUUID } from 'crypto'
import { InvoiceType, PaymentMethod, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { recordAuditEvent } from '@/lib/audit/record'


export interface CreatePaymentInput {
  orderId: string
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: Date
  invoiceNo?: string
  invoiceType?: InvoiceType
  remarks?: string
  operatorId: string
  requestId: string
}


export class CreatePaymentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'CreatePaymentError'
  }
}


function matchesInput(payment: {
  orderId: string
  amount: Prisma.Decimal
  paymentMethod: PaymentMethod
  paymentDate: Date
  invoiceNo: string | null
  invoiceType: InvoiceType | null
  remarks: string | null
  operatorId: string
}, input: CreatePaymentInput): boolean {
  return payment.orderId === input.orderId
    && payment.amount.equals(input.amount)
    && payment.paymentMethod === input.paymentMethod
    && payment.paymentDate.getTime() === input.paymentDate.getTime()
    && payment.invoiceNo === (input.invoiceNo || null)
    && payment.invoiceType === (input.invoiceType || null)
    && payment.remarks === (input.remarks || null)
    && payment.operatorId === input.operatorId
}

async function replayForRequest(input: CreatePaymentInput) {
  const existing = await prisma.payment.findUnique({ where: { requestId: input.requestId } })
  if (!existing) return null
  if (!matchesInput(existing, input)) {
    throw new CreatePaymentError('请求号已用于另一笔收款', 409, 'PAYMENT_REQUEST_CONFLICT')
  }
  return existing
}

export async function createPayment(input: CreatePaymentInput) {
  const amount = new Prisma.Decimal(input.amount.toFixed(2))
  const replay = await replayForRequest(input)
  if (replay) return { payment: replay, replayed: true }

  try {
    const payment = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.payment.findUnique({ where: { requestId: input.requestId } })
        if (existing) {
          if (!matchesInput(existing, input)) {
            throw new CreatePaymentError('请求号已用于另一笔收款', 409, 'PAYMENT_REQUEST_CONFLICT')
          }
          return existing
        }
        const order = await tx.order.findUnique({ where: { id: input.orderId } })
        if (!order) {
          throw new CreatePaymentError('订单不存在', 404, 'ORDER_NOT_FOUND')
        }
        if (order.status === 'CANCELLED') {
          throw new CreatePaymentError('已取消订单不能登记收款', 400, 'ORDER_CANCELLED')
        }
        if (amount.greaterThan(order.unpaidAmount)) {
          throw new CreatePaymentError('收款金额超过订单未收金额', 400, 'AMOUNT_EXCEEDS_UNPAID')
        }

        const unpaidAmount = order.unpaidAmount.minus(amount)
        const payment = await tx.payment.create({
          data: {
            paymentNo: `PAY-${Date.now()}-${randomUUID().slice(0, 8)}`,
            requestId: input.requestId,
            orderId: input.orderId,
            amount,
            paymentMethod: input.paymentMethod,
            paymentDate: input.paymentDate,
            invoiceNo: input.invoiceNo,
            invoiceType: input.invoiceType,
            remarks: input.remarks,
            operatorId: input.operatorId,
          },
        })
        await tx.order.update({
          where: { id: input.orderId },
          data: {
            paidAmount: order.paidAmount.plus(amount),
            unpaidAmount,
            status: unpaidAmount.isZero() ? 'COMPLETED' : order.status,
          },
        })
        await recordAuditEvent(tx, {
          actorId: input.operatorId,
          action: 'CREATE_PAYMENT',
          entityType: 'Payment',
          entityId: payment.id,
          afterData: payment,
          reason: 'PAYMENT_CREATED',
          requestId: input.requestId,
        })
        return payment
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      }
    )
    return { payment, replayed: false }
  } catch (error) {
    if (error instanceof CreatePaymentError) {
      throw error
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new CreatePaymentError('订单金额正在更新，请刷新后重试', 409, 'PAYMENT_CONFLICT')
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await replayForRequest(input)
      if (existing) return { payment: existing, replayed: true }
      throw new CreatePaymentError('收款正在创建，请刷新后重试', 409, 'PAYMENT_CONFLICT')
    }
    throw error
  }
}
