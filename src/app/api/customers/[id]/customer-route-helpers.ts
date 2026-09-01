import { CustomerLevel, CustomerSource, CustomerStatus, Prisma, type Customer } from '@prisma/client'
import { z } from 'zod'

const customerUpdateSchema = z.object({
  name: z.string().trim().max(100).optional(),
  company: z.string().trim().max(200).nullable().optional(),
  phone: z.preprocess(
    (value) => value === '' || value === null ? null : value,
    z.string().trim().min(3, '联系电话格式不正确').max(20).nullable().optional(),
  ),
  email: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().optional(),
  source: z.string().trim().optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  status: z.string().trim().optional(),
})

export type CustomerUpdatePayload = z.infer<typeof customerUpdateSchema>

const categoryMap: Record<string, CustomerLevel> = {
  潜在客户: CustomerLevel.POTENTIAL,
  普通客户: CustomerLevel.NORMAL,
  重要客户: CustomerLevel.IMPORTANT,
  VIP客户: CustomerLevel.VIP,
}

export class CustomerRouteError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message)
    this.name = 'CustomerRouteError'
  }
}

export function parseCustomerUpdate(payload: unknown) {
  return customerUpdateSchema.safeParse(payload)
}

export function buildCustomerUpdateData(payload: CustomerUpdatePayload, existing: Customer): Prisma.CustomerUpdateInput {
  return {
    name: payload.name ?? existing.name,
    company: payload.company,
    phone: payload.phone,
    email: payload.email,
    address: payload.address,
    level: payload.category ? categoryMap[payload.category] || existing.level : existing.level,
    source: Object.values(CustomerSource).includes(payload.source as CustomerSource)
      ? payload.source as CustomerSource
      : existing.source,
    notes: payload.notes,
    status: Object.values(CustomerStatus).includes(payload.status as CustomerStatus)
      ? payload.status as CustomerStatus
      : existing.status,
  }
}
