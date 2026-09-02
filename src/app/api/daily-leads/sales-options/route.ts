import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { listDailyLeadSalesOptions } from '@/lib/reports/daily-lead-sales-options'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }

    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('read', 'customer')) {
      return jsonWithRequestId({ error: '无权查看每日新增客资' }, requestId, { status: 403 })
    }

    const options = await listDailyLeadSalesOptions(
      session.user.id,
      session.user.roles || []
    )
    return jsonWithRequestId({ success: true, data: options }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/daily-leads/sales-options', requestId)
  }
}
