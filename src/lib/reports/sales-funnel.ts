import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

interface FunnelRow {
  leadCount: bigint
  contactedCount: bigint
  proposalCount: bigint
  negotiationCount: bigint
  wonCount: bigint
  leadDays: number | null
  contactedDays: number | null
  proposalDays: number | null
  negotiationDays: number | null
  wonDays: number | null
  salesCycleDays: number | null
}

const stageDefinitions = [
  { stage: 'LEAD', name: '线索客户', count: 'leadCount', days: 'leadDays' },
  { stage: 'CONTACTED', name: '已跟进', count: 'contactedCount', days: 'contactedDays' },
  { stage: 'PROPOSAL', name: '有订单', count: 'proposalCount', days: 'proposalDays' },
  { stage: 'NEGOTIATION', name: '待确认', count: 'negotiationCount', days: 'negotiationDays' },
  { stage: 'CLOSED_WON', name: '已成交', count: 'wonCount', days: 'wonDays' },
] as const

export async function querySalesFunnel(accessibleUserIds: string[] | null, now: Date) {
  const scope = accessibleUserIds === null
    ? Prisma.sql`1 = 1`
    : accessibleUserIds.length === 0
      ? Prisma.sql`1 = 0`
      : Prisma.sql`c.salesId IN (${Prisma.join(accessibleUserIds)})`
  const rows = await prisma.$queryRaw<FunnelRow[]>(Prisma.sql`
    SELECT
      SUM(c.status = 'ACTIVE' AND c.isPublic = FALSE) AS leadCount,
      SUM(c.lastFollowUpAt IS NOT NULL) AS contactedCount,
      SUM(EXISTS(SELECT 1 FROM \`Order\` o WHERE o.customerId = c.id)) AS proposalCount,
      SUM(EXISTS(SELECT 1 FROM \`Order\` o WHERE o.customerId = c.id AND o.status IN ('PENDING', 'CONFIRMED'))) AS negotiationCount,
      SUM(EXISTS(SELECT 1 FROM \`Order\` o WHERE o.customerId = c.id AND o.status = 'COMPLETED')) AS wonCount,
      AVG(CASE WHEN c.status = 'ACTIVE' AND c.isPublic = FALSE THEN TIMESTAMPDIFF(DAY, c.createdAt, ${now}) END) AS leadDays,
      AVG(CASE WHEN c.lastFollowUpAt IS NOT NULL THEN TIMESTAMPDIFF(DAY, c.createdAt, ${now}) END) AS contactedDays,
      AVG(CASE WHEN EXISTS(SELECT 1 FROM \`Order\` o WHERE o.customerId = c.id) THEN TIMESTAMPDIFF(DAY, c.createdAt, ${now}) END) AS proposalDays,
      AVG(CASE WHEN EXISTS(SELECT 1 FROM \`Order\` o WHERE o.customerId = c.id AND o.status IN ('PENDING', 'CONFIRMED')) THEN TIMESTAMPDIFF(DAY, c.createdAt, ${now}) END) AS negotiationDays,
      AVG(CASE WHEN EXISTS(SELECT 1 FROM \`Order\` o WHERE o.customerId = c.id AND o.status = 'COMPLETED') THEN TIMESTAMPDIFF(DAY, c.createdAt, ${now}) END) AS wonDays,
      AVG(CASE WHEN EXISTS(SELECT 1 FROM \`Order\` o WHERE o.customerId = c.id AND o.status = 'COMPLETED')
        THEN TIMESTAMPDIFF(DAY, c.createdAt, (SELECT MIN(o.createdAt) FROM \`Order\` o WHERE o.customerId = c.id AND o.status = 'COMPLETED')) END) AS salesCycleDays
    FROM Customer c
    WHERE ${scope}
  `)
  const row = rows[0]
  const counts = stageDefinitions.map((definition) => Number(row?.[definition.count] ?? 0))
  const stages = stageDefinitions.map((definition, index) => ({
    stage: definition.stage,
    name: definition.name,
    count: counts[index],
    conversionRate: index === 0 || counts[index - 1] === 0
      ? index === 0 ? 100 : 0
      : Number(((counts[index] / counts[index - 1]) * 100).toFixed(2)),
    avgDaysInStage: Math.round(Number(row?.[definition.days] ?? 0)),
  }))
  return {
    stages,
    overallConversionRate: counts[0] > 0
      ? Number(((counts[counts.length - 1] / counts[0]) * 100).toFixed(2))
      : 0,
    avgSalesCycle: Math.round(Number(row?.salesCycleDays ?? 0)),
  }
}
