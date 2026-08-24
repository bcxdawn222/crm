import { Prisma } from '@prisma/client'

import { recordAuditEvent } from '@/lib/audit/record'
import { canAccessSalesData, getUserAndSubordinateIds } from '@/lib/data-permission'
import { prisma } from '@/lib/prisma'

const TRANSFER_ROLES = ['admin', 'sales_manager']
const TARGET_ROLES = ['sales', 'sales_manager']

export interface TransferCustomerInput {
  customerId: string
  targetSalesId: string
  reason?: string
  actorId: string
  actorRoles: string[]
  requestId: string
}

export class CustomerTransferError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'CustomerTransferError'
  }
}

function canTransfer(roles: string[]): boolean {
  return TRANSFER_ROLES.some((role) => roles.includes(role))
}

async function targetScope(actorId: string, roles: string[]): Promise<Prisma.UserWhereInput> {
  const roleFilter: Prisma.UserWhereInput = {
    roles: { some: { role: { name: { in: TARGET_ROLES } } } },
  }
  if (roles.includes('admin')) {
    return { status: 'ACTIVE', ...roleFilter }
  }
  const userIds = await getUserAndSubordinateIds(actorId)
  return { id: { in: userIds }, status: 'ACTIVE', ...roleFilter }
}

function auditTarget(afterData: Prisma.JsonValue | null): string | null {
  if (!afterData || Array.isArray(afterData) || typeof afterData !== 'object') return null
  const targetSalesId = afterData.targetSalesId
  return typeof targetSalesId === 'string' ? targetSalesId : null
}

async function replayForRequest(input: TransferCustomerInput) {
  const audit = await prisma.auditEvent.findFirst({
    where: {
      requestId: input.requestId,
      entityType: 'Customer',
      entityId: input.customerId,
      reason: 'CUSTOMER_TRANSFERRED',
    },
    orderBy: { createdAt: 'asc' },
  })
  if (!audit) return null
  if (auditTarget(audit.afterData) !== input.targetSalesId) {
    throw new CustomerTransferError(
      '请求号已用于另一笔客户转移',
      409,
      'CUSTOMER_TRANSFER_REQUEST_CONFLICT'
    )
  }
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } })
  if (!customer || customer.salesId !== input.targetSalesId) {
    throw new CustomerTransferError(
      '客户在该请求后又发生了归属变化',
      409,
      'CUSTOMER_TRANSFER_STATE_CHANGED'
    )
  }
  return customer
}

export async function listCustomerTransferTargets(
  actorId: string,
  actorRoles: string[],
  keyword: string
) {
  if (!canTransfer(actorRoles)) {
    throw new CustomerTransferError('无权转移客户', 403, 'TRANSFER_PERMISSION_DENIED')
  }
  const scope = await targetScope(actorId, actorRoles)
  const keywordFilter: Prisma.UserWhereInput = keyword
    ? {
        OR: [
          { realName: { contains: keyword } },
          { username: { contains: keyword } },
          { department: { contains: keyword } },
        ],
      }
    : {}
  return prisma.user.findMany({
    where: { AND: [scope, keywordFilter] },
    take: 50,
    orderBy: [{ realName: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      realName: true,
      username: true,
      department: true,
      position: true,
    },
  })
}

export async function transferCustomer(input: TransferCustomerInput) {
  if (!canTransfer(input.actorRoles)) {
    throw new CustomerTransferError('无权转移客户', 403, 'TRANSFER_PERMISSION_DENIED')
  }
  const replay = await replayForRequest(input)
  if (replay) return { customer: replay, replayed: true }

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } })
  if (!customer) {
    throw new CustomerTransferError('客户不存在', 404, 'CUSTOMER_NOT_FOUND')
  }
  if (customer.isPublic) {
    throw new CustomerTransferError('公海客户应通过认领流程处理', 409, 'PUBLIC_CUSTOMER')
  }
  if (!await canAccessSalesData(input.actorId, input.actorRoles, customer.salesId)) {
    throw new CustomerTransferError('无权转移该客户', 403, 'DATA_SCOPE_DENIED')
  }
  if (customer.salesId === input.targetSalesId) {
    throw new CustomerTransferError('客户已归属目标销售', 409, 'ALREADY_ASSIGNED')
  }

  const target = await prisma.user.findFirst({
    where: { AND: [await targetScope(input.actorId, input.actorRoles), { id: input.targetSalesId }] },
    select: { id: true, realName: true },
  })
  if (!target) {
    throw new CustomerTransferError('目标销售不存在或不在可分配范围', 400, 'TARGET_OUT_OF_SCOPE')
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({
        where: {
          id: input.customerId,
          salesId: customer.salesId,
          isPublic: false,
        },
        data: { salesId: target.id },
      })
      if (result.count !== 1) {
        throw new CustomerTransferError(
          '客户归属已变化，请刷新后重试',
          409,
          'CUSTOMER_TRANSFER_CONFLICT'
        )
      }
      const transferred = await tx.customer.findUnique({ where: { id: input.customerId } })
      if (!transferred) {
        throw new CustomerTransferError('转移后客户不存在', 500, 'TRANSFER_RESULT_MISSING')
      }
      await recordAuditEvent(tx, {
        actorId: input.actorId,
        action: 'TRANSFER',
        entityType: 'Customer',
        entityId: input.customerId,
        beforeData: customer,
        afterData: {
          customer: transferred,
          fromSalesId: customer.salesId,
          targetSalesId: target.id,
          targetSalesName: target.realName,
        },
        reason: 'CUSTOMER_TRANSFERRED',
        requestId: input.requestId,
      })
      return transferred
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { customer: updated, replayed: false }
  } catch (error) {
    const concurrentReplay = await replayForRequest(input)
    if (concurrentReplay) return { customer: concurrentReplay, replayed: true }
    if (error instanceof CustomerTransferError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new CustomerTransferError(
        '客户归属正在更新，请刷新后重试',
        409,
        'CUSTOMER_TRANSFER_CONFLICT'
      )
    }
    throw error
  }
}
