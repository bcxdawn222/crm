import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { appendPublicPoolHistory, PublicPoolHistoryError } from './history'
import { recordAuditEvent } from '@/lib/audit/record'


export interface ClaimActor {
  id: string
  realName: string
  requestId?: string
}


export class PublicPoolClaimError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'PublicPoolClaimError'
  }
}


async function validateClaimQuota(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      maxActiveCustomers: true,
      maxDailyClaims: true,
      roles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
    },
  })

  if (!user) {
    throw new PublicPoolClaimError('当前登录用户不存在', 401, 'USER_NOT_FOUND')
  }
  if (user.roles.some(({ role }) => role.name === 'admin')) {
    return
  }

  const activeCount = await tx.customer.count({
    where: {
      salesId: userId,
      isPublic: false,
      status: 'ACTIVE',
    },
  })
  if (activeCount >= user.maxActiveCustomers) {
    throw new PublicPoolClaimError(
      `当前活跃客户数为 ${activeCount}，已达到上限 ${user.maxActiveCustomers}`,
      400,
      'ACTIVE_CUSTOMER_LIMIT_EXCEEDED'
    )
  }

  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const todayClaims = await tx.customer.count({
    where: {
      salesId: userId,
      isPublic: false,
      publicPoolEnteredAt: { gte: startOfDay },
    },
  })
  if (todayClaims >= user.maxDailyClaims) {
    throw new PublicPoolClaimError(
      `今日已认领 ${todayClaims} 个客户，已达到上限 ${user.maxDailyClaims}`,
      400,
      'DAILY_CLAIM_LIMIT_EXCEEDED'
    )
  }
}


export async function claimPublicPoolCustomer(customerId: string, actor: ClaimActor) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date()
        await validateClaimQuota(tx, actor.id, now)

        const customer = await tx.customer.findUnique({ where: { id: customerId } })
        if (!customer) {
          throw new PublicPoolClaimError('客户不存在', 404, 'CUSTOMER_NOT_FOUND')
        }
        if (!customer.isPublic) {
          throw new PublicPoolClaimError('客户已被认领，请刷新列表', 409, 'ALREADY_CLAIMED')
        }

        const history = appendPublicPoolHistory(customer.publicPoolHistory, {
          type: 'CLAIMED',
          claimedAt: now.toISOString(),
          claimedBy: actor.id,
          claimedByName: actor.realName,
          fromSalesId: customer.originalSalesId ?? customer.salesId,
        })
        const result = await tx.customer.updateMany({
          where: { id: customerId, isPublic: true },
          data: {
            isPublic: false,
            salesId: actor.id,
            status: 'ACTIVE',
            originalSalesId: customer.originalSalesId ?? customer.salesId,
            publicPoolEnteredAt: customer.publicPoolEnteredAt ?? now,
            publicPoolHistory: history,
          },
        })
        if (result.count !== 1) {
          throw new PublicPoolClaimError('客户已被认领，请刷新列表', 409, 'CLAIM_CONFLICT')
        }

        const updatedCustomer = await tx.customer.findUnique({ where: { id: customerId } })
        if (!updatedCustomer) {
          throw new PublicPoolClaimError('认领后客户数据不存在', 500, 'CLAIM_RESULT_MISSING')
        }
        await recordAuditEvent(tx, {
          actorId: actor.id,
          action: 'CLAIM',
          entityType: 'Customer',
          entityId: customerId,
          beforeData: customer,
          afterData: updatedCustomer,
          reason: 'PUBLIC_POOL_CLAIM',
          requestId: actor.requestId,
        })
        return updatedCustomer
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      }
    )
  } catch (error) {
    if (error instanceof PublicPoolClaimError) {
      throw error
    }
    if (error instanceof PublicPoolHistoryError) {
      throw new PublicPoolClaimError(error.message, 409, 'INVALID_HISTORY')
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new PublicPoolClaimError('认领冲突，请刷新后重试', 409, 'CLAIM_CONFLICT')
    }
    throw error
  }
}
