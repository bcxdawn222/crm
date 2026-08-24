import { z } from 'zod'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { CustomerTransferError, transferCustomer } from '@/lib/customers/transfer'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

const transferSchema = z.object({
  targetSalesId: z.string().uuid('目标销售 ID 格式不正确'),
  reason: z.string().trim().max(500, '转移原因不能超过 500 个字符').optional(),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions)
    if (ability.cannot('update', 'customer')) {
      return jsonWithRequestId({ error: '无权转移客户' }, requestId, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    }
    const parsed = transferSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message || '转移信息不正确' },
        requestId,
        { status: 400 }
      )
    }

    const result = await transferCustomer({
      customerId: params.id,
      ...parsed.data,
      actorId: session.user.id,
      actorRoles: session.user.roles,
      requestId,
    })
    return jsonWithRequestId({
      success: true,
      data: result.customer,
      replayed: result.replayed,
      message: result.replayed ? '该客户转移请求已完成' : '客户转移成功',
    }, requestId)
  } catch (error) {
    if (error instanceof CustomerTransferError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'POST /api/customers/[id]/transfer', requestId)
  }
}
