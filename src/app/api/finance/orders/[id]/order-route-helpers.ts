import { OrderStatus, Prisma } from '@prisma/client'
import { z } from 'zod'

export const updateOrderSchema = z.object({
  contractNo: z.string().trim().max(50).nullable().optional(),
  contractAmount: z.coerce.number().min(0).max(99_999_999.99).optional(),
  currency: z.enum(['CNY', 'USD', 'EUR']).optional(),
  signDate: z.coerce.date().nullable().optional(),
  deliveryDate: z.coerce.date().nullable().optional(),
  remarks: z.string().trim().max(10_000).nullable().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
}).refine(
  (data) => !data.signDate || !data.deliveryDate || data.deliveryDate >= data.signDate,
  '交付日期不能早于签约日期',
)

interface OrderAmounts {
  contractAmount: Prisma.Decimal
  paidAmount: Prisma.Decimal
  unpaidAmount: Prisma.Decimal
}

export function serializeOrderAmounts<T extends OrderAmounts>(order: T) {
  return {
    ...order,
    contractAmount: order.contractAmount.toNumber(),
    paidAmount: order.paidAmount.toNumber(),
    unpaidAmount: order.unpaidAmount.toNumber(),
  }
}

export function serializeOrderDetails<T extends OrderAmounts & { payments: Array<{ amount: Prisma.Decimal }> }>(order: T) {
  return {
    ...serializeOrderAmounts(order),
    payments: order.payments.map((payment) => ({ ...payment, amount: payment.amount.toNumber() })),
  }
}
