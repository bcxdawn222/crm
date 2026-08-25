import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { autoMoveCustomers } from '@/lib/public-pool/auto-move'

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'customer')) {
      return NextResponse.json({ error: 'No permission' }, { status: 403 })
    }

    const result = await autoMoveCustomers({ actorId: session.user.id, requestId })
    return jsonWithRequestId({
      success: true,
      data: {
        movedCount: result.details.length,
        details: result.details,
        limitReached: result.limitReached,
      },
      message: result.limitReached
        ? `本次已处理 ${result.details.length} 个客户，仍有数据时可再次执行`
        : `成功将 ${result.details.length} 个客户移入公海池`,
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/public-pool/auto-move', requestId)
  }
}
