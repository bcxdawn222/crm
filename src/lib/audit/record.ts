import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { sanitizeAuditData } from './sanitize'

export interface AuditRecordInput {
  actorId?: string
  action: string
  entityType: string
  entityId?: string
  beforeData?: unknown
  afterData?: unknown
  reason?: string
  requestId?: string
}

export type AuditDbClient = Prisma.TransactionClient | typeof prisma

export async function recordAuditEvent(
  db: AuditDbClient,
  input: AuditRecordInput
): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeData: sanitizeAuditData(input.beforeData),
      afterData: sanitizeAuditData(input.afterData),
      reason: input.reason,
      requestId: input.requestId,
    },
  })
}
