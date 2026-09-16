import { CustomerLevel, CustomerSource, Prisma } from '@prisma/client'

import { recordAuditEvent } from '@/lib/audit/record'
import { canAccessSalesData } from '@/lib/data-permission'
import { prisma } from '@/lib/prisma'

export interface ConvertTelemarketingInput {
  telemarketingId: string
  level: CustomerLevel
  source: CustomerSource
  notes?: string
  actorId: string
  actorRoles: readonly string[]
  requestId: string
}

export class TelemarketingConvertError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'TelemarketingConvertError'
  }
}

export async function convertTelemarketingToCustomer(input: ConvertTelemarketingInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM TelemarketingList
        WHERE id = ${input.telemarketingId}
        FOR UPDATE
      `
      if (locked.length !== 1) {
        throw new TelemarketingConvertError('电销记录不存在', 404, 'TELEMARKETING_NOT_FOUND')
      }

      const telemarketing = await tx.telemarketingList.findUnique({
        where: { id: input.telemarketingId },
        include: { customer: true },
      })
      if (!telemarketing) {
        throw new TelemarketingConvertError('电销记录不存在', 404, 'TELEMARKETING_NOT_FOUND')
      }
      if (!(await canAccessSalesData(input.actorId, input.actorRoles, telemarketing.salesId))) {
        throw new TelemarketingConvertError('无权转化该电销记录', 403, 'DATA_SCOPE_DENIED')
      }
      if (telemarketing.customer) {
        return {
          customer: telemarketing.customer,
          telemarketing,
          replayed: true,
        }
      }

      const phone = telemarketing.phone.trim() || null
      if (phone) {
        const duplicate = await tx.customer.findFirst({
          where: { phone },
          select: { id: true },
        })
        if (duplicate) {
          throw new TelemarketingConvertError(
            '该电话号码已存在客户记录',
            409,
            'CUSTOMER_PHONE_EXISTS'
          )
        }
      }

      const customer = await tx.customer.create({
        data: {
          name: telemarketing.name,
          company: telemarketing.company,
          phone,
          industry: telemarketing.industry,
          level: input.level,
          source: input.source,
          notes: input.notes || telemarketing.notes,
          salesId: telemarketing.salesId,
          isPublic: false,
          status: 'ACTIVE',
        },
      })
      const updatedTelemarketing = await tx.telemarketingList.update({
        where: { id: input.telemarketingId },
        data: {
          customerId: customer.id,
          isEffective: true,
          status: 'CONVERTED',
        },
      })
      await recordAuditEvent(tx, {
        actorId: input.actorId,
        action: 'CONVERT',
        entityType: 'TelemarketingList',
        entityId: input.telemarketingId,
        beforeData: telemarketing,
        afterData: { telemarketing: updatedTelemarketing, customer },
        reason: 'TELEMARKETING_CONVERTED',
        requestId: input.requestId,
      })
      return {
        customer,
        telemarketing: updatedTelemarketing,
        replayed: false,
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    })
  } catch (error) {
    if (error instanceof TelemarketingConvertError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new TelemarketingConvertError(
        '电销记录正在转化，请刷新后重试',
        409,
        'TELEMARKETING_CONVERT_CONFLICT'
      )
    }
    throw error
  }
}
