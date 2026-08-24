import bcrypt from 'bcryptjs'
import { Prisma, UserStatus } from '@prisma/client'

import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'
import {
  assertManagerAssignment,
  assertRolesExist,
  nullableValue,
  updateUserSchema,
  UserAdminError,
  userAdminSelect,
  userAuditSnapshot,
} from '@/lib/users/admin'


interface RouteContext {
  params: { id: string }
}

function auditAction(previous: UserStatus, next: UserStatus | undefined): string {
  if (next === UserStatus.INACTIVE && previous !== UserStatus.INACTIVE) return 'USER_DISABLED'
  if (next === UserStatus.ACTIVE && previous !== UserStatus.ACTIVE) return 'USER_ACTIVATED'
  if (next === UserStatus.LOCKED && previous !== UserStatus.LOCKED) return 'USER_LOCKED'
  return 'USER_UPDATED'
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'user')) {
      return jsonWithRequestId({ error: '无权修改用户' }, requestId, { status: 403 })
    }
    const body: unknown = await request.json()
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId({ error: parsed.error.issues[0]?.message || '用户信息不正确' }, requestId, { status: 400 })
    }
    if (parsed.data.roleIds && ability.cannot('update', 'role')) {
      return jsonWithRequestId({ error: '无权修改用户角色' }, requestId, { status: 403 })
    }
    if (parsed.data.status && parsed.data.status !== UserStatus.ACTIVE && ability.cannot('delete', 'user')) {
      return jsonWithRequestId({ error: '无权停用或锁定用户' }, requestId, { status: 403 })
    }
    if (params.id === session.user.id && parsed.data.status && parsed.data.status !== UserStatus.ACTIVE) {
      return jsonWithRequestId({ error: '不能停用或锁定当前登录账号' }, requestId, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { id: params.id }, select: userAdminSelect })
    if (!existing) {
      return jsonWithRequestId({ error: '用户不存在' }, requestId, { status: 404 })
    }
    const password = parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : undefined
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.roleIds) await assertRolesExist(tx, parsed.data.roleIds)
      await assertManagerAssignment(tx, params.id, parsed.data.managerId)
      const user = await tx.user.update({
        where: { id: params.id },
        data: {
          username: parsed.data.username,
          email: parsed.data.email,
          password,
          realName: parsed.data.realName,
          phone: nullableValue(parsed.data.phone),
          department: nullableValue(parsed.data.department),
          position: nullableValue(parsed.data.position),
          status: parsed.data.status,
          manager: parsed.data.managerId === null
            ? { disconnect: true }
            : parsed.data.managerId
              ? { connect: { id: parsed.data.managerId } }
              : undefined,
          roles: parsed.data.roleIds
            ? { deleteMany: {}, create: parsed.data.roleIds.map((roleId) => ({ roleId })) }
            : undefined,
        },
        select: userAdminSelect,
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: auditAction(existing.status, parsed.data.status),
        entityType: 'User',
        entityId: user.id,
        beforeData: userAuditSnapshot(existing),
        afterData: {
          ...userAuditSnapshot(user),
          passwordChanged: Boolean(parsed.data.password),
        },
        requestId,
      })
      return user
    })
    return jsonWithRequestId({ success: true, data: updated }, requestId)
  } catch (error) {
    if (error instanceof UserAdminError) {
      return jsonWithRequestId({ error: error.message }, requestId, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return jsonWithRequestId({ error: '用户名或邮箱已存在' }, requestId, { status: 409 })
    }
    return serverErrorResponse(error, `PATCH /api/users/${params.id}`, requestId)
  }
}
