import { Prisma, TelemarketingResult, TelemarketingStatus } from '@prisma/client'
import { z } from 'zod'

import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { canAccessSalesData, getAccessibleUserIds } from '@/lib/data-permission'
import { CRM_PHONE_MESSAGE, isCrmPhone, normalizeCrmPhone } from '@/lib/http/phone'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { parsePagination } from '@/lib/http/pagination'
import { prisma } from '@/lib/prisma'
import {
  canAssignTelemarketingOwner,
  loadAccessibleTelemarketing,
  resolveTelemarketingOwner,
} from '@/lib/telemarketing/scope'

const optionalText = (max: number) => z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.string().trim().max(max).optional()
)

const emptyText = (max: number) => z.preprocess(
  (value) => value === undefined || value === null ? '' : value,
  z.string().trim().max(max)
)

const phoneSchema = z.preprocess(
  (value) => typeof value === 'string' ? normalizeCrmPhone(value) : value,
  z.string().max(20).refine((value) => isCrmPhone(value), CRM_PHONE_MESSAGE)
)

const optionalPhoneSchema = z.preprocess(
  (value) => value === '' || value === null || value === undefined
    ? undefined
    : typeof value === 'string' ? normalizeCrmPhone(value) : value,
  z.string().max(20).refine((value) => isCrmPhone(value), CRM_PHONE_MESSAGE).optional()
)

const createSchema = z.object({
  name: emptyText(100),
  company: optionalText(200),
  phone: phoneSchema,
  position: optionalText(50),
  industry: optionalText(50),
  source: optionalText(100),
  notes: optionalText(10_000),
  status: z.nativeEnum(TelemarketingStatus).optional(),
  isEffective: z.boolean().optional(),
  result: z.nativeEnum(TelemarketingResult).nullable().optional(),
  salesId: z.string().uuid().optional(),
})

const updateSchema = z.object({
  name: optionalText(100),
  company: optionalText(200),
  phone: optionalPhoneSchema,
  position: optionalText(50),
  industry: optionalText(50),
  source: optionalText(100),
  notes: optionalText(10_000),
  status: z.nativeEnum(TelemarketingStatus).optional(),
  isEffective: z.boolean().optional(),
  result: z.nativeEnum(TelemarketingResult).nullable().optional(),
  salesId: z.string().uuid().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), '没有需要保存的电销字段')

const salesInclude = {
  sales: { select: { id: true, realName: true, username: true } },
  customer: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.TelemarketingListInclude

function recordId(request: Request): string | null {
  return new URL(request.url).searchParams.get('id')
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
    if (!session.user.permissions.includes('lead:view')) {
      return jsonWithRequestId({ error: '无权查看电销名单' }, requestId, { status: 403 })
    }

    const searchParams = new URL(request.url).searchParams
    const pagination = parsePagination(searchParams)
    if (!pagination) return jsonWithRequestId({ error: '分页参数不正确' }, requestId, { status: 400 })

    const accessibleUserIds = await getAccessibleUserIds(session.user.id, session.user.roles)
    const where: Prisma.TelemarketingListWhereInput = accessibleUserIds === null
      ? {}
      : { salesId: { in: accessibleUserIds } }

    const salesId = searchParams.get('salesId')?.trim()
    if (salesId) {
      if (!z.string().uuid().safeParse(salesId).success) {
        return jsonWithRequestId({ error: '销售筛选参数不正确' }, requestId, { status: 400 })
      }
      if (!(await canAccessSalesData(session.user.id, session.user.roles, salesId))) {
        return jsonWithRequestId({ error: '无权查看电销名单' }, requestId, { status: 403 })
      }
      where.salesId = salesId
    }

    const status = searchParams.get('status')
    const isEffective = searchParams.get('isEffective')
    const keyword = searchParams.get('keyword')?.trim()
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
        include: salesInclude,
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
    if (!session.user.permissions.includes('lead:create')) {
      return jsonWithRequestId({ error: '无权创建电销记录' }, requestId, { status: 403 })
    }
    const body = await requestBody(request)
    if (body === null) return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId({ error: parsed.error.issues[0]?.message || '电销信息不正确' }, requestId, { status: 400 })
    }
    const { salesId: requestedSalesId, ...fields } = parsed.data
    const owner = await resolveTelemarketingOwner({
      actorId: session.user.id,
      actorRoles: session.user.roles,
      requestedSalesId,
    })
    if ('error' in owner) {
      return jsonWithRequestId({ error: owner.error }, requestId, { status: owner.status })
    }

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.telemarketingList.create({
        data: {
          ...fields,
          salesId: owner.salesId,
          status: fields.status ?? TelemarketingStatus.PENDING,
          isEffective: fields.isEffective ?? false,
        },
        include: salesInclude,
      })
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
    if (!session.user.permissions.includes('lead:update')) {
      return jsonWithRequestId({ error: '无权更新电销记录' }, requestId, { status: 403 })
    }
    const id = recordId(request)
    if (!id) return jsonWithRequestId({ error: '缺少电销记录 ID' }, requestId, { status: 400 })
    const accessible = await loadAccessibleTelemarketing(id, session.user.id, session.user.roles)
    if ('error' in accessible) {
      return jsonWithRequestId({ error: accessible.error }, requestId, { status: accessible.status })
    }
    const body = await requestBody(request)
    if (body === null) return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId({ error: parsed.error.issues[0]?.message || '电销信息不正确' }, requestId, { status: 400 })
    }

    const { salesId: requestedSalesId, ...fields } = parsed.data
    let nextSalesId: string | undefined
    if (requestedSalesId !== undefined && requestedSalesId !== accessible.record.salesId) {
      if (!canAssignTelemarketingOwner(session.user.roles)) {
        return jsonWithRequestId({ error: '无权改派电销负责人' }, requestId, { status: 403 })
      }
      const owner = await resolveTelemarketingOwner({
        actorId: session.user.id,
        actorRoles: session.user.roles,
        requestedSalesId,
      })
      if ('error' in owner) {
        return jsonWithRequestId({ error: owner.error }, requestId, { status: owner.status })
      }
      nextSalesId = owner.salesId
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.telemarketingList.update({
        where: { id },
        data: {
          ...fields,
          ...(nextSalesId ? { salesId: nextSalesId } : {}),
        },
        include: salesInclude,
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'UPDATE',
        entityType: 'TelemarketingList',
        entityId: id,
        beforeData: accessible.record,
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
    if (!session.user.permissions.includes('lead:update')) {
      return jsonWithRequestId({ error: '无权删除电销记录' }, requestId, { status: 403 })
    }
    const id = recordId(request)
    if (!id) return jsonWithRequestId({ error: '缺少电销记录 ID' }, requestId, { status: 400 })
    const accessible = await loadAccessibleTelemarketing(id, session.user.id, session.user.roles)
    if ('error' in accessible) {
      return jsonWithRequestId({ error: accessible.error }, requestId, { status: accessible.status })
    }
    if (accessible.record.customerId) {
      return jsonWithRequestId({ error: '已转客户的电销记录不能删除', code: 'CONVERTED_RECORD' }, requestId, { status: 409 })
    }
    await prisma.$transaction(async (tx) => {
      await tx.telemarketingList.delete({ where: { id } })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'DELETE',
        entityType: 'TelemarketingList',
        entityId: id,
        beforeData: accessible.record,
        reason: 'TELEMARKETING_DELETED',
        requestId,
      })
    })
    return jsonWithRequestId({ success: true, message: '电销记录删除成功' }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'DELETE /api/telemarketing', requestId)
  }
}
