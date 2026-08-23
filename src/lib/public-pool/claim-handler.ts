import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { claimPublicPoolCustomer, PublicPoolClaimError } from './claim'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'


const claimRequestSchema = z.object({
  customerId: z.string().uuid('客户 ID 格式不正确'),
})


export async function handlePublicPoolClaim(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: 'Unauthorized' }, requestId, { status: 401 })
    }

    const ability = defineAbility(session.user.permissions)
    if (ability.cannot('update', 'customer')) {
      return jsonWithRequestId({ error: 'No permission to claim customer' }, requestId, { status: 403 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    }
    const parsed = claimRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message ?? '请求参数不正确' },
        requestId,
        { status: 400 }
      )
    }

    const customer = await claimPublicPoolCustomer(parsed.data.customerId, {
      id: session.user.id,
      realName: session.user.realName,
      requestId,
    })
    return jsonWithRequestId({ success: true, data: customer, message: '认领成功' }, requestId)
  } catch (error) {
    if (error instanceof PublicPoolClaimError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'POST /api/public-pool/claim', requestId)
  }
}
