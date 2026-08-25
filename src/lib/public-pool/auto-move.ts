import type { Prisma } from '@prisma/client'

import { recordAuditEvent } from '@/lib/audit/record'
import { prisma } from '@/lib/prisma'
import { appendPublicPoolHistory } from './history'

const MAX_CUSTOMERS_PER_RUN = 200
const TRANSACTION_BATCH_SIZE = 25

interface Candidate {
  id: string
  name: string
  salesId: string
  updatedAt: Date
  publicPoolHistory: Prisma.JsonValue | null
}

interface MoveRule {
  code: 'RULE_1' | 'RULE_2' | 'RULE_3'
  reason: string
  where: Prisma.CustomerWhereInput
}

export interface AutoMoveDetail {
  customerId: string
  customerName: string
  rule: MoveRule['code']
  reason: string
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function buildRules(now: Date): MoveRule[] {
  return [
    {
      code: 'RULE_1',
      reason: '超过90天未跟进',
      where: {
        isPublic: false,
        status: 'ACTIVE',
        lastFollowUpAt: { lt: new Date(now.getTime() - 90 * 86400000) },
      },
    },
    {
      code: 'RULE_2',
      reason: '创建超过30天且从未跟进',
      where: {
        isPublic: false,
        status: 'ACTIVE',
        createdAt: { lt: new Date(now.getTime() - 30 * 86400000) },
        lastFollowUpAt: null,
      },
    },
    {
      code: 'RULE_3',
      reason: '合同到期超过60天未续签',
      where: {
        isPublic: false,
        contractEndDate: { lt: new Date(now.getTime() - 60 * 86400000) },
        status: { not: 'COOPERATING' },
      },
    },
  ]
}

async function moveBatch(input: {
  actorId: string
  requestId: string
  now: Date
  rule: MoveRule
  candidates: Candidate[]
}): Promise<AutoMoveDetail[]> {
  return prisma.$transaction(async (tx) => {
    const moved: AutoMoveDetail[] = []
    for (const candidate of input.candidates) {
      const history = appendPublicPoolHistory(candidate.publicPoolHistory, {
        type: 'ARCHIVED',
        archivedAt: input.now.toISOString(),
        archivedBy: input.actorId,
        fromSalesId: candidate.salesId,
        reason: input.rule.code,
        reasonText: input.rule.reason,
      })
      const result = await tx.customer.updateMany({
        where: {
          ...input.rule.where,
          id: candidate.id,
          salesId: candidate.salesId,
          updatedAt: candidate.updatedAt,
        },
        data: {
          isPublic: true,
          status: 'INACTIVE',
          publicPoolEnteredAt: input.now,
          publicPoolReason: input.rule.code,
          originalSalesId: candidate.salesId,
          publicPoolHistory: history,
        },
      })
      if (result.count === 0) continue
      const updated = await tx.customer.findUniqueOrThrow({ where: { id: candidate.id } })
      await recordAuditEvent(tx, {
        actorId: input.actorId,
        action: 'AUTO_MOVE_TO_PUBLIC_POOL',
        entityType: 'Customer',
        entityId: updated.id,
        beforeData: candidate,
        afterData: updated,
        reason: input.rule.code,
        requestId: input.requestId,
      })
      moved.push({
        customerId: candidate.id,
        customerName: candidate.name,
        rule: input.rule.code,
        reason: input.rule.reason,
      })
    }
    return moved
  })
}

export async function autoMoveCustomers(input: {
  actorId: string
  requestId: string
  now?: Date
}): Promise<{ details: AutoMoveDetail[]; limitReached: boolean }> {
  const now = input.now ?? new Date()
  const details: AutoMoveDetail[] = []
  for (const rule of buildRules(now)) {
    const remaining = MAX_CUSTOMERS_PER_RUN - details.length
    if (remaining <= 0) break
    const candidates = await prisma.customer.findMany({
      where: rule.where,
      select: { id: true, name: true, salesId: true, updatedAt: true, publicPoolHistory: true },
      orderBy: { id: 'asc' },
      take: remaining,
    })
    for (const batch of chunks(candidates, TRANSACTION_BATCH_SIZE)) {
      details.push(...await moveBatch({ ...input, now, rule, candidates: batch }))
    }
  }
  return { details, limitReached: details.length >= MAX_CUSTOMERS_PER_RUN }
}
