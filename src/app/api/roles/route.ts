import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'
import { roleAdminSelect, roleResponse } from '@/lib/roles/admin'


export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('read', 'role') && ability.cannot('update', 'role')) {
      return jsonWithRequestId({ error: '无权查看角色' }, requestId, { status: 403 })
    }

    const roles = await prisma.role.findMany({
      select: roleAdminSelect,
      orderBy: { createdAt: 'asc' },
    })
    const includePermissions = new URL(request.url).searchParams.get('includePermissions') === 'true'
    const availablePermissions = includePermissions && ability.can('update', 'role')
      ? await prisma.permission.findMany({
          select: { id: true, code: true, name: true, module: true },
          orderBy: [{ module: 'asc' }, { code: 'asc' }],
        })
      : undefined

    return jsonWithRequestId({
      success: true,
      data: roles.map(roleResponse),
      ...(availablePermissions ? { availablePermissions } : {}),
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/roles', requestId)
  }
}
