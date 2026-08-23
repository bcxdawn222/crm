import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// POST /api/public-pool/auto-move - 自动将符合条件的客户移入公海池
export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only admin or sales_manager can trigger this
    const permissions = (session.user?.permissions as string[]) || []
    const ability = defineAbility(permissions)
    if (ability.cannot('update', 'customer')) {
      return NextResponse.json({ error: 'No permission' }, { status: 403 })
    }

    const now = new Date()
    let movedCount = 0
    const moveLogs: Array<{ customerId: string; customerName: string; rule: string; reason: string }> = []

    // ========== 规则1: 长期未跟进(90天) ==========
    console.log('[Public Pool] Rule 1: Moving customers with no follow-up for 90+ days...')
    const rule1Customers = await prisma.customer.findMany({
      where: {
        isPublic: false,
        status: 'ACTIVE',
        lastFollowUpAt: {
          lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        name: true,
        salesId: true
      }
    })

    for (const customer of rule1Customers) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where: { id: customer.id },
          data: {
            isPublic: true,
            status: 'INACTIVE',
            publicPoolEnteredAt: now,
            publicPoolReason: 'RULE_1',
            originalSalesId: customer.salesId,
            publicPoolHistory: {
              push: {
                enteredAt: now.toISOString(),
                reason: 'RULE_1',
                reasonText: '超过90天未跟进',
                fromSalesId: customer.salesId
              }
            }
          }
        })
        await recordAuditEvent(tx, {
          actorId: session.user.id,
          action: 'AUTO_MOVE_TO_PUBLIC_POOL',
          entityType: 'Customer',
          entityId: updated.id,
          beforeData: customer,
          afterData: updated,
          reason: 'RULE_1',
          requestId,
        })
      })
      movedCount++
      moveLogs.push({
        customerId: customer.id,
        customerName: customer.name,
        rule: 'RULE_1',
        reason: '超过90天未跟进'
      })
    }
    console.log(`[Public Pool] Rule 1: Moved ${rule1Customers.length} customers`)

    // ========== 规则2: 创建后从未跟进(30天) ==========
    console.log('[Public Pool] Rule 2: Moving customers created 30+ days ago with no follow-up...')
    const rule2Customers = await prisma.customer.findMany({
      where: {
        isPublic: false,
        status: 'ACTIVE',
        createdAt: {
          lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        },
        lastFollowUpAt: null
      },
      select: {
        id: true,
        name: true,
        salesId: true
      }
    })

    for (const customer of rule2Customers) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where: { id: customer.id },
          data: {
            isPublic: true,
            status: 'INACTIVE',
            publicPoolEnteredAt: now,
            publicPoolReason: 'RULE_2',
            originalSalesId: customer.salesId,
            publicPoolHistory: {
              push: {
                enteredAt: now.toISOString(),
                reason: 'RULE_2',
                reasonText: '创建超过30天且从未跟进',
                fromSalesId: customer.salesId
              }
            }
          }
        })
        await recordAuditEvent(tx, {
          actorId: session.user.id,
          action: 'AUTO_MOVE_TO_PUBLIC_POOL',
          entityType: 'Customer',
          entityId: updated.id,
          beforeData: customer,
          afterData: updated,
          reason: 'RULE_2',
          requestId,
        })
      })
      movedCount++
      moveLogs.push({
        customerId: customer.id,
        customerName: customer.name,
        rule: 'RULE_2',
        reason: '创建超过30天且从未跟进'
      })
    }
    console.log(`[Public Pool] Rule 2: Moved ${rule2Customers.length} customers`)

    // ========== 规则3: 合同到期未续签(60天) ==========
    console.log('[Public Pool] Rule 3: Moving customers with expired contracts...')
    const rule3Customers = await prisma.customer.findMany({
      where: {
        isPublic: false,
        contractEndDate: {
          lt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        },
        status: {
          not: 'COOPERATING'
        }
      },
      select: {
        id: true,
        name: true,
        salesId: true
      }
    })

    for (const customer of rule3Customers) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.customer.update({
          where: { id: customer.id },
          data: {
            isPublic: true,
            status: 'INACTIVE',
            publicPoolEnteredAt: now,
            publicPoolReason: 'RULE_3',
            originalSalesId: customer.salesId,
            publicPoolHistory: {
              push: {
                enteredAt: now.toISOString(),
                reason: 'RULE_3',
                reasonText: '合同到期超过60天未续签',
                fromSalesId: customer.salesId
              }
            }
          }
        })
        await recordAuditEvent(tx, {
          actorId: session.user.id,
          action: 'AUTO_MOVE_TO_PUBLIC_POOL',
          entityType: 'Customer',
          entityId: updated.id,
          beforeData: customer,
          afterData: updated,
          reason: 'RULE_3',
          requestId,
        })
      })
      movedCount++
      moveLogs.push({
        customerId: customer.id,
        customerName: customer.name,
        rule: 'RULE_3',
        reason: '合同到期超过60天未续签'
      })
    }
    console.log(`[Public Pool] Rule 3: Moved ${rule3Customers.length} customers`)

    console.log(`[Public Pool Auto-Move] Total moved: ${movedCount} customers`)
    console.log('Move logs:', moveLogs)

    return jsonWithRequestId({
      success: true,
      data: {
        movedCount,
        details: moveLogs
      },
      message: `成功将${movedCount}个客户移入公海池`
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/public-pool/auto-move', requestId)
  }
}
