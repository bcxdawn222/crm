import { Prisma } from '@prisma/client'

import { canAccessSalesData } from '@/lib/data-permission'
import { prisma } from '@/lib/prisma'
import { appendPublicPoolHistory, PublicPoolHistoryError } from './history'
import { recordAuditEvent } from '@/lib/audit/record'


export interface ArchiveActor {
  id: string
  realName: string
  roles: string[]
  requestId?: string
}


export class PublicPoolArchiveError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'PublicPoolArchiveError'
  }
}


export async function archiveCustomerToPublicPool(
  customerId: string,
  actor: ArchiveActor,
  reason: string
) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) {
    throw new PublicPoolArchiveError('客户不存在', 404, 'CUSTOMER_NOT_FOUND')
  }
  if (customer.isPublic) {
    throw new PublicPoolArchiveError('客户已在公海池中', 409, 'ALREADY_PUBLIC')
  }
  if (!await canAccessSalesData(actor.id, actor.roles, customer.salesId)) {
    throw new PublicPoolArchiveError('无权归档该客户', 403, 'DATA_SCOPE_DENIED')
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date()
        const history = appendPublicPoolHistory(customer.publicPoolHistory, {
          type: 'ARCHIVED',
          archivedAt: now.toISOString(),
          archivedBy: actor.id,
          archivedByName: actor.realName,
          fromSalesId: customer.salesId,
          reason,
        })
        const result = await tx.customer.updateMany({
          where: { id: customerId, isPublic: false, salesId: customer.salesId },
          data: {
            isPublic: true,
            status: 'INACTIVE',
            originalSalesId: customer.salesId,
            publicPoolEnteredAt: now,
            publicPoolReason: reason,
            publicPoolHistory: history,
          },
        })
        if (result.count !== 1) {
          throw new PublicPoolArchiveError('客户状态已变化，请刷新后重试', 409, 'ARCHIVE_CONFLICT')
        }
        const updatedCustomer = await tx.customer.findUnique({ where: { id: customerId } })
        if (!updatedCustomer) {
          throw new PublicPoolArchiveError('归档后客户数据不存在', 500, 'ARCHIVE_RESULT_MISSING')
        }
        await recordAuditEvent(tx, {
          actorId: actor.id,
          action: 'ARCHIVE_TO_PUBLIC_POOL',
          entityType: 'Customer',
          entityId: customerId,
          beforeData: customer,
          afterData: updatedCustomer,
          reason,
          requestId: actor.requestId,
        })
        return updatedCustomer
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (error) {
    if (error instanceof PublicPoolArchiveError) {
      throw error
    }
    if (error instanceof PublicPoolHistoryError) {
      throw new PublicPoolArchiveError(error.message, 409, 'INVALID_HISTORY')
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new PublicPoolArchiveError('归档冲突，请刷新后重试', 409, 'ARCHIVE_CONFLICT')
    }
    throw error
  }
}
