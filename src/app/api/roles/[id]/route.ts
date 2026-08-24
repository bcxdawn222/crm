import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'
import {
  roleAdminSelect,
  RoleAdminError,
  roleAuditSnapshot,
  roleResponse,
  updateRoleSchema,
  validatePermissionSelection,
} from '@/lib/roles/admin'


interface RouteContext {
  params: { id: string }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'role')) {
      return jsonWithRequestId({ error: '无权修改角色' }, requestId, { status: 403 })
    }
    const body: unknown = await request.json()
    const parsed = updateRoleSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId({ error: parsed.error.issues[0]?.message || '角色信息不正确' }, requestId, { status: 400 })
    }
    const existing = await prisma.role.findUnique({ where: { id: params.id }, select: roleAdminSelect })
    if (!existing) {
      return jsonWithRequestId({ error: '角色不存在' }, requestId, { status: 404 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.permissionIds) {
        await validatePermissionSelection(tx, existing.name, parsed.data.permissionIds)
      }
      const role = await tx.role.update({
        where: { id: params.id },
        data: {
          displayName: parsed.data.displayName,
          description: parsed.data.description === '' ? null : parsed.data.description,
          permissions: parsed.data.permissionIds
            ? {
                deleteMany: {},
                create: parsed.data.permissionIds.map((permissionId) => ({ permissionId })),
              }
            : undefined,
        },
        select: roleAdminSelect,
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'ROLE_UPDATED',
        entityType: 'Role',
        entityId: role.id,
        beforeData: roleAuditSnapshot(existing),
        afterData: roleAuditSnapshot(role),
        requestId,
      })
      return role
    })
    return jsonWithRequestId({ success: true, data: roleResponse(updated) }, requestId)
  } catch (error) {
    if (error instanceof RoleAdminError) {
      return jsonWithRequestId({ error: error.message }, requestId, { status: error.status })
    }
    return serverErrorResponse(error, `PATCH /api/roles/${params.id}`, requestId)
  }
}
