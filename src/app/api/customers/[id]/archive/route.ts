import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { archiveCustomerToPublicPool, PublicPoolArchiveError } from '@/lib/public-pool/archive'
import { z } from 'zod'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'


const archiveRequestSchema = z.object({
  reason: z.string().trim().min(1).max(200).default('MANUAL_ARCHIVE'),
})

// POST /api/customers/[id]/archive - 归档客户到公海池
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('update', 'customer')) {
      return NextResponse.json({ error: 'No permission to archive customer' }, { status: 403 })
    }

    const requestText = await request.text()
    let payload: unknown = {}
    if (requestText) {
      try {
        payload = JSON.parse(requestText)
      } catch {
        return NextResponse.json({ error: '请求内容不是有效 JSON' }, { status: 400 })
      }
    }
    const parsed = archiveRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: '归档原因长度必须在 1 到 200 个字符之间' }, { status: 400 })
    }

    const updated = await archiveCustomerToPublicPool(
      params.id,
      {
      id: session.user.id,
      realName: session.user.realName,
      roles: session.user.roles,
      requestId,
      },
      parsed.data.reason
    )

    return jsonWithRequestId({
      success: true,
      data: updated,
      message: 'Customer archived to public pool successfully'
    }, requestId)
  } catch (error) {
    if (error instanceof PublicPoolArchiveError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'POST /api/customers/[id]/archive', requestId)
  }
}
