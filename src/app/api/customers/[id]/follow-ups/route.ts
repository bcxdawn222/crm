import { FollowUpStatus, FollowUpType } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { canAccessSalesData } from '@/lib/data-permission'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'


const followUpSchema = z.object({
  type: z.nativeEnum(FollowUpType),
  content: z.string().trim().min(1, '请填写跟进内容').max(5000),
  result: z.string().trim().max(500).optional(),
  nextAction: z.string().trim().max(500).optional(),
  nextFollowUpAt: z.coerce.date().optional(),
  plannedFollowUpId: z.string().uuid().optional(),
})


export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }

    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('create', 'followUp')) {
      return jsonWithRequestId({ error: '无权新增跟进记录' }, requestId, { status: 403 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    }
    const parsed = followUpSchema.safeParse(payload)
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message ?? '跟进参数不正确' },
        requestId,
        { status: 400 }
      )
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: { id: true, salesId: true, isPublic: true, status: true },
    })
    if (!customer || customer.status === 'INACTIVE') {
      return jsonWithRequestId({ error: '客户不存在或已停用' }, requestId, { status: 404 })
    }
    if (customer.isPublic) {
      return jsonWithRequestId({ error: '公海客户需认领后才能跟进' }, requestId, { status: 409 })
    }
    const canAccess = await canAccessSalesData(
      session.user.id,
      session.user.roles || [],
      customer.salesId
    )
    if (!canAccess) {
      return jsonWithRequestId({ error: '无权跟进该客户' }, requestId, { status: 403 })
    }

    const now = new Date()
    const followUp = await prisma.$transaction(async (tx) => {
      let saved
      if (parsed.data.plannedFollowUpId) {
        const planned = await tx.followUp.findFirst({
          where: {
            id: parsed.data.plannedFollowUpId,
            customerId: customer.id,
            status: FollowUpStatus.PLANNED,
          },
        })
        if (!planned) {
          throw new PlannedFollowUpError()
        }
        saved = await tx.followUp.update({
          where: { id: planned.id },
          data: {
            type: parsed.data.type,
            content: parsed.data.content,
            result: parsed.data.result,
            nextAction: parsed.data.nextAction,
            nextFollowUpAt: parsed.data.nextFollowUpAt,
            status: FollowUpStatus.COMPLETED,
          },
        })
        await recordAuditEvent(tx, {
          actorId: session.user.id,
          action: 'COMPLETE',
          entityType: 'FollowUp',
          entityId: saved.id,
          beforeData: planned,
          afterData: saved,
          reason: 'PLANNED_FOLLOW_UP_COMPLETED',
          requestId,
        })
      } else {
        saved = await tx.followUp.create({
          data: {
            customerId: customer.id,
            salesId: session.user.id,
            type: parsed.data.type,
            content: parsed.data.content,
            result: parsed.data.result,
            nextAction: parsed.data.nextAction,
            nextFollowUpAt: parsed.data.nextFollowUpAt,
            status: FollowUpStatus.COMPLETED,
          },
        })
        await recordAuditEvent(tx, {
          actorId: session.user.id,
          action: 'CREATE',
          entityType: 'FollowUp',
          entityId: saved.id,
          afterData: saved,
          reason: 'FOLLOW_UP_CREATED',
          requestId,
        })
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          lastFollowUpAt: now,
          nextFollowUpAt: parsed.data.nextFollowUpAt ?? null,
        },
      })
      return saved
    })

    return jsonWithRequestId(
      { success: true, data: followUp, message: '跟进记录已保存' },
      requestId
    )
  } catch (error) {
    if (error instanceof PlannedFollowUpError) {
      return jsonWithRequestId(
        { error: '计划跟进不存在或已经完成' },
        requestId,
        { status: 409 }
      )
    }
    return serverErrorResponse(error, 'POST /api/customers/[id]/follow-ups', requestId)
  }
}


class PlannedFollowUpError extends Error {}
