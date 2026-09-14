import { auth } from '@/lib/auth'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { listTelemarketingOwners } from '@/lib/telemarketing/scope'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }
    if (!session.user.permissions.includes('lead:view') && !session.user.permissions.includes('lead:create')) {
      return jsonWithRequestId({ error: '无权查看电销负责人' }, requestId, { status: 403 })
    }
    const owners = await listTelemarketingOwners(session.user.id, session.user.roles)
    return jsonWithRequestId({ success: true, data: owners }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/telemarketing/owners', requestId)
  }
}
