import { auth } from '@/lib/auth'
import { recordAuditEvent } from '@/lib/audit/record'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'


export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('read', 'message')) {
      return jsonWithRequestId({ error: '无权操作消息' }, requestId, { status: 403 })
    }
    const updated = await prisma.$transaction(async (tx) => {
      const readAt = new Date()
      const result = await tx.message.updateMany({
        where: { receiverId: session.user.id, isRead: false },
        data: { isRead: true, readAt },
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'MESSAGE_READ_ALL',
        entityType: 'Message',
        afterData: { updated: result.count, readAt },
        requestId,
      })
      return result.count
    })
    return jsonWithRequestId({ success: true, data: { updated } }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/messages/read-all', requestId)
  }
}
