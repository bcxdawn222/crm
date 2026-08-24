import { Prisma, UserStatus } from '@prisma/client'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { recordAuditEvent } from '@/lib/audit/record'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter, canAccessSalesData } from '@/lib/data-permission'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  keyword: z.string().trim().max(100).optional(),
  expiringSoon: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
})

const nullableDate = z.union([z.null(), z.coerce.date()])
const nullableAmount = z.union([z.null(), z.coerce.number().min(0).max(99_999_999.99)])
const updateSchema = z.object({
  contractStartDate: nullableDate.optional(),
  contractEndDate: nullableDate.optional(),
  contractAmount: nullableAmount.optional(),
  renewalReminderDays: z.coerce.number().int().min(1).max(365).optional(),
  lastVisitAt: nullableDate.optional(),
  nextVisitAt: nullableDate.optional(),
  visitFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).nullable().optional(),
  cooperationNotes: z.string().trim().max(10_000).nullable().optional(),
  operationManagerId: z.string().uuid().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, '至少提交一个可更新字段')
  .refine(
    (data) => !data.contractStartDate || !data.contractEndDate || data.contractStartDate <= data.contractEndDate,
    '合同结束日期不能早于开始日期'
  )
  .refine(
    (data) => !data.lastVisitAt || !data.nextVisitAt || data.lastVisitAt <= data.nextVisitAt,
    '下次回访日期不能早于最后回访日期'
  )

const markSchema = z.object({
  customerId: z.string().uuid(),
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
  contractAmount: z.coerce.number().min(0).max(99_999_999.99).optional(),
}).refine(
  (data) => !data.contractStartDate || !data.contractEndDate || data.contractStartDate <= data.contractEndDate,
  '合同结束日期不能早于开始日期'
)

class CooperatingCustomerConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CooperatingCustomerConflictError'
  }
}

function invalidDateRange(start: Date | null | undefined, end: Date | null | undefined): boolean {
  return Boolean(start && end && start > end)
}

async function parseJson(request: Request): Promise<unknown | null> {
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
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('read', 'customer')) {
      return jsonWithRequestId({ error: '无权查看合作客户' }, requestId, { status: 403 })
    }

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message ?? '查询参数不正确' },
        requestId,
        { status: 400 }
      )
    }
    const { page, pageSize, keyword, expiringSoon } = parsed.data
    const where: Prisma.CustomerWhereInput = {
      status: 'COOPERATING',
      ...await buildDataFilter(session.user.id, session.user.roles),
    }
    if (expiringSoon) {
      const today = new Date()
      const reminderDate = new Date(today)
      reminderDate.setDate(today.getDate() + 30)
      where.contractEndDate = { lte: reminderDate, gte: today }
    }
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { company: { contains: keyword } },
        { contactPerson: { contains: keyword } },
      ]
    }

    const [total, customers] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { contractEndDate: 'asc' },
        include: {
          sales: { select: { id: true, realName: true } },
          operationManager: { select: { id: true, realName: true } },
        },
      }),
    ])
    return jsonWithRequestId({
      success: true,
      data: { list: customers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/customers/cooperating', requestId)
  }
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'customer')) {
      return jsonWithRequestId({ error: '无权更新合作客户' }, requestId, { status: 403 })
    }
    const id = new URL(request.url).searchParams.get('id')
    if (!id || !z.string().uuid().safeParse(id).success) {
      return jsonWithRequestId({ error: '客户 ID 格式不正确' }, requestId, { status: 400 })
    }
    const payload = await parseJson(request)
    if (payload === null) {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    }
    const parsed = updateSchema.safeParse(payload)
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message ?? '合作客户参数不正确' },
        requestId,
        { status: 400 }
      )
    }

    const customer = await prisma.customer.findUnique({ where: { id } })
    if (!customer) {
      return jsonWithRequestId({ error: '客户不存在' }, requestId, { status: 404 })
    }
    if (!await canAccessSalesData(session.user.id, session.user.roles, customer.salesId)) {
      return jsonWithRequestId({ error: '无权更新该客户' }, requestId, { status: 403 })
    }
    if (customer.status !== 'COOPERATING') {
      return jsonWithRequestId({ error: '只有已合作客户可以维护合作信息' }, requestId, { status: 409 })
    }
    const nextContractStart = parsed.data.contractStartDate === undefined
      ? customer.contractStartDate
      : parsed.data.contractStartDate
    const nextContractEnd = parsed.data.contractEndDate === undefined
      ? customer.contractEndDate
      : parsed.data.contractEndDate
    const nextLastVisit = parsed.data.lastVisitAt === undefined
      ? customer.lastVisitAt
      : parsed.data.lastVisitAt
    const nextVisit = parsed.data.nextVisitAt === undefined
      ? customer.nextVisitAt
      : parsed.data.nextVisitAt
    if (invalidDateRange(nextContractStart, nextContractEnd)) {
      return jsonWithRequestId({ error: '合同结束日期不能早于开始日期' }, requestId, { status: 400 })
    }
    if (invalidDateRange(nextLastVisit, nextVisit)) {
      return jsonWithRequestId({ error: '下次回访日期不能早于最后回访日期' }, requestId, { status: 400 })
    }
    if (parsed.data.operationManagerId) {
      const manager = await prisma.user.findFirst({
        where: { id: parsed.data.operationManagerId, status: UserStatus.ACTIVE },
        select: { id: true },
      })
      if (!manager) {
        return jsonWithRequestId({ error: '运营负责人不存在或已停用' }, requestId, { status: 400 })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const writeResult = await tx.customer.updateMany({
        where: { id, status: 'COOPERATING' },
        data: parsed.data,
      })
      if (writeResult.count !== 1) {
        throw new CooperatingCustomerConflictError('客户合作状态已变化，请刷新后重试')
      }
      const result = await tx.customer.findUniqueOrThrow({ where: { id } })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'UPDATE',
        entityType: 'Customer',
        entityId: id,
        beforeData: customer,
        afterData: result,
        reason: 'COOPERATING_CUSTOMER_UPDATED',
        requestId,
      })
      return result
    })
    return jsonWithRequestId({
      success: true,
      data: updated,
      message: '合作客户信息更新成功',
    }, requestId)
  } catch (error) {
    if (error instanceof CooperatingCustomerConflictError) {
      return jsonWithRequestId({ error: error.message, requestId }, requestId, { status: 409 })
    }
    return serverErrorResponse(error, 'PUT /api/customers/cooperating', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'customer')) {
      return jsonWithRequestId({ error: '无权标记合作客户' }, requestId, { status: 403 })
    }
    const payload = await parseJson(request)
    if (payload === null) {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    }
    const parsed = markSchema.safeParse(payload)
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message ?? '合作客户参数不正确' },
        requestId,
        { status: 400 }
      )
    }
    const customer = await prisma.customer.findUnique({ where: { id: parsed.data.customerId } })
    if (!customer) {
      return jsonWithRequestId({ error: '客户不存在' }, requestId, { status: 404 })
    }
    if (!await canAccessSalesData(session.user.id, session.user.roles, customer.salesId)) {
      return jsonWithRequestId({ error: '无权更新该客户' }, requestId, { status: 403 })
    }
    if (customer.status === 'COOPERATING') {
      return jsonWithRequestId({ error: '客户已经是合作状态' }, requestId, { status: 409 })
    }

    const { customerId, ...cooperationData } = parsed.data
    const nextContractStart = cooperationData.contractStartDate ?? customer.contractStartDate
    const nextContractEnd = cooperationData.contractEndDate ?? customer.contractEndDate
    if (invalidDateRange(nextContractStart, nextContractEnd)) {
      return jsonWithRequestId({ error: '合同结束日期不能早于开始日期' }, requestId, { status: 400 })
    }
    const updated = await prisma.$transaction(async (tx) => {
      const writeResult = await tx.customer.updateMany({
        where: { id: customerId, status: { not: 'COOPERATING' } },
        data: { ...cooperationData, status: 'COOPERATING' },
      })
      if (writeResult.count !== 1) {
        throw new CooperatingCustomerConflictError('客户已经是合作状态')
      }
      const result = await tx.customer.findUniqueOrThrow({ where: { id: customerId } })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'UPDATE',
        entityType: 'Customer',
        entityId: customerId,
        beforeData: customer,
        afterData: result,
        reason: 'CUSTOMER_MARKED_COOPERATING',
        requestId,
      })
      return result
    })
    return jsonWithRequestId({
      success: true,
      data: updated,
      message: '客户已标记为合作状态',
    }, requestId)
  } catch (error) {
    if (error instanceof CooperatingCustomerConflictError) {
      return jsonWithRequestId({ error: error.message, requestId }, requestId, { status: 409 })
    }
    return serverErrorResponse(error, 'POST /api/customers/cooperating', requestId)
  }
}
