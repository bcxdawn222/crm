import { CustomerLevel, CustomerSource } from '@prisma/client'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import {
  convertTelemarketingToCustomer,
  TelemarketingConvertError,
} from '@/lib/telemarketing/convert'

const convertSchema = z.object({
  telemarketingId: z.string().uuid('电销记录 ID 格式不正确'),
  level: z.nativeEnum(CustomerLevel).default(CustomerLevel.POTENTIAL),
  source: z.nativeEnum(CustomerSource).default(CustomerSource.COLD_CALL),
  notes: z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().trim().max(5000, '备注不能超过 5000 个字符').optional(),
  ),
})

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    if (!session.user.permissions.includes('lead:convert')
      || !session.user.permissions.includes('customer:create')) {
      return jsonWithRequestId({ error: '无权转化电销记录' }, requestId, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    }
    const parsed = convertSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message || '转化信息不正确' },
        requestId,
        { status: 400 }
      )
    }

    const result = await convertTelemarketingToCustomer({
      ...parsed.data,
      actorId: session.user.id,
      actorRoles: session.user.roles,
      requestId,
    })
    return jsonWithRequestId({
      success: true,
      data: {
        customer: result.customer,
        telemarketing: result.telemarketing,
      },
      replayed: result.replayed,
      message: result.replayed ? '该电销记录已转入客户' : '已成功转入我的客户',
    }, requestId, { status: result.replayed ? 200 : 201 })
  } catch (error) {
    if (error instanceof TelemarketingConvertError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'POST /api/telemarketing/convert', requestId)
  }
}
