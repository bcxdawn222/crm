import { Prisma, TelemarketingStatus } from '@prisma/client'
import { z } from 'zod'

import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { parsePagination } from '@/lib/http/pagination'
import { prisma } from '@/lib/prisma'

const optionalText = (max: number) => z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.string().trim().max(max).optional()
)

const recordSchema = z.object({
  name: z.string().trim().min(1, '客户姓名为必填项').max(100),
  company: optionalText(200),
  phone: z.string().trim().min(3, '电话号码格式不正确').max(20),
  position: optionalText(50),
  industry: optionalText(50),
  source: optionalText(100),
  notes: optionalText(10_000),
})

function recordId(request: Request): string | null {
  return new URL(request.url).searchParams.get('id')
}

async function ownedRecord(id: string, actorId: string) {
  const record = await prisma.telemarketingList.findUnique({ where: { id } })
  if (!record) return { error: '电销记录不存在', status: 404 } as const
  if (record.salesId !== actorId) return { error: '无权操作该电销记录', status: 403 } as const
  return { record } as const
}

async function requestBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('read', 'customer')) {
      return jsonWithRequestId({ error: '无权查看电销名单' }, requestId, { status: 403 })
    }

    const searchParams = new URL(request.url).searchParams
    const pagination = parsePagination(searchParams)
    if (!pagination) return jsonWithRequestId({ error: '分页参数不正确' }, requestId, { status: 400 })
    const status = searchParams.get('status')
    const isEffective = searchParams.get('isEffective')
    const keyword = searchParams.get('keyword')?.trim()
    const where: Prisma.TelemarketingListWhereInput = { salesId: session.user.id }
    if (status && status !== 'all') {
      if (!Object.values(TelemarketingStatus).includes(status as TelemarketingStatus)) {
        return jsonWithRequestId({ error: '电销状态不正确' }, requestId, { status: 400 })
      }
      where.status = status as TelemarketingStatus
    }
    if (isEffective === 'true' || isEffective === 'false') where.isEffective = isEffective === 'true'
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { company: { contains: keyword } },
        { phone: { contains: keyword } },
      ]
    }

    const [total, list] = await prisma.$transaction([
      prisma.telemarketingList.count({ where }),
      prisma.telemarketingList.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, name: true, phone: true } } },
      }),
    ])
    return jsonWithRequestId({
      success: true,
      data: { list, total, ...pagination, totalPages: Math.ceil(total / pagination.pageSize) },
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/telemarketing', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('create', 'customer')) {
      return jsonWithRequestId({ error: '无权创建电销记录' }, requestId, { status: 403 })
    }
    const body = await requestBody(request)
    if (body === null) return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    const parsed = recordSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId({ error: parsed.error.issues[0]?.message || '电销信息不正确' }, requestId, { status: 400 })
    }
    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.telemarketingList.create({ data: { ...parsed.data, salesId: session.user.id } })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'CREATE',
        entityType: 'TelemarketingList',
        entityId: created.id,
        afterData: created,
        reason: 'TELEMARKETING_CREATED',
        requestId,
      })
      return created
    })
    return jsonWithRequestId({ success: true, data: record, message: '电销记录创建成功' }, requestId, { status: 201 })
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/telemarketing', requestId)
  }
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'lead')) {
      return jsonWithRequestId({ error: '无权更新电销记录' }, requestId, { status: 403 })
    }
    const id = recordId(request)
    if (!id) return jsonWithRequestId({ error: '缺少电销记录 ID' }, requestId, { status: 400 })
    const owned = await ownedRecord(id, session.user.id)
    if ('error' in owned) return jsonWithRequestId({ error: owned.error }, requestId, { status: owned.status })
    const body = await requestBody(request)
    if (body === null) return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    const parsed = recordSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId({ error: parsed.error.issues[0]?.message || '电销信息不正确' }, requestId, { status: 400 })
    }
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.telemarketingList.update({ where: { id }, data: parsed.data })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'UPDATE',
        entityType: 'TelemarketingList',
        entityId: id,
        beforeData: owned.record,
        afterData: record,
        reason: 'TELEMARKETING_UPDATED',
        requestId,
      })
      return record
    })
    return jsonWithRequestId({ success: true, data: updated, message: '电销记录更新成功' }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'PUT /api/telemarketing', requestId)
  }
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'lead')) {
      return jsonWithRequestId({ error: '无权删除电销记录' }, requestId, { status: 403 })
    }
    const id = recordId(request)
    if (!id) return jsonWithRequestId({ error: '缺少电销记录 ID' }, requestId, { status: 400 })
    const owned = await ownedRecord(id, session.user.id)
    if ('error' in owned) return jsonWithRequestId({ error: owned.error }, requestId, { status: owned.status })
    if (owned.record.customerId) {
      return jsonWithRequestId({ error: '已转客户的电销记录不能删除', code: 'CONVERTED_RECORD' }, requestId, { status: 409 })
    }
    await prisma.$transaction(async (tx) => {
      await tx.telemarketingList.delete({ where: { id } })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'DELETE',
        entityType: 'TelemarketingList',
        entityId: id,
        beforeData: owned.record,
        reason: 'TELEMARKETING_DELETED',
        requestId,
      })
    })
    return jsonWithRequestId({ success: true, message: '电销记录删除成功' }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'DELETE /api/telemarketing', requestId)
  }
}
