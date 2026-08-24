import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'customer')) {
      return jsonWithRequestId({ error: '无权选择运营负责人' }, requestId, { status: 403 })
    }
    const keyword = new URL(request.url).searchParams.get('keyword')?.trim().slice(0, 100) || ''
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(keyword ? {
          OR: [
            { realName: { contains: keyword } },
            { username: { contains: keyword } },
            { department: { contains: keyword } },
          ],
        } : {}),
      },
      take: 50,
      orderBy: [{ realName: 'asc' }, { username: 'asc' }],
      select: {
        id: true,
        realName: true,
        username: true,
        department: true,
        position: true,
      },
    })
    return jsonWithRequestId({ success: true, data: users }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/customers/operation-manager-options', requestId)
  }
}
