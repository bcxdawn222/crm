import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getAccessibleUserIds } from '@/lib/data-permission'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { querySalesTrend } from '@/lib/reports/sales-trend'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const permissions = session.user.permissions || []
    const ability = defineAbility(permissions)
    if (!permissions.includes('report:view') || ability.cannot('read', 'report')) {
      return NextResponse.json({ error: 'No permission to access statistics' }, { status: 403 })
    }

    const period = new URL(request.url).searchParams.get('period') || '30d'
    const accessibleUserIds = await getAccessibleUserIds(session.user.id, session.user.roles)
    const data = await querySalesTrend({ period, accessibleUserIds, now: new Date() })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/statistics/trend', requestId)
  }
}
