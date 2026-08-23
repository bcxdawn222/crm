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
  requestId?: string
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


export async function createPayment(input: CreatePaymentInput) {
  const amount = new Prisma.Decimal(input.amount.toFixed(2))

  try {
    return await prisma.$transaction(
      async (tx) => {
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
  } catch (error) {
    if (error instanceof CreatePaymentError) {
      throw error
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new CreatePaymentError('订单金额正在更新，请刷新后重试', 409, 'PAYMENT_CONFLICT')
    }
    throw error
  }
}
