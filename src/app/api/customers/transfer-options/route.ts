import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import {
  CustomerTransferError,
  listCustomerTransferTargets,
} from '@/lib/customers/transfer'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions)
    if (ability.cannot('update', 'customer')) {
      return jsonWithRequestId({ error: '无权选择目标销售' }, requestId, { status: 403 })
    }
    const keyword = new URL(request.url).searchParams.get('keyword')?.trim().slice(0, 100) || ''
    const users = await listCustomerTransferTargets(
      session.user.id,
      session.user.roles,
      keyword
    )
    return jsonWithRequestId({ success: true, data: users }, requestId)
  } catch (error) {
    if (error instanceof CustomerTransferError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'GET /api/customers/transfer-options', requestId)
  }
}
