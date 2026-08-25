import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'

import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { parsePagination } from '@/lib/http/pagination'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'
import {
  assertManagerAssignment,
  assertRolesExist,
  createUserSchema,
  nullableValue,
  UserAdminError,
  userAdminSelect,
  userAuditSnapshot,
} from '@/lib/users/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'user')) {
      return jsonWithRequestId({ error: '无权查看用户' }, requestId, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams, { defaultPageSize: 20, maxPageSize: 100 })
    if (!pagination) {
      return jsonWithRequestId({ error: '分页参数不正确' }, requestId, { status: 400 })
    }
    const role = searchParams.get('role')
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const where: Prisma.UserWhereInput = includeInactive ? {} : { status: 'ACTIVE' }
    if (role) {
      where.roles = { some: { role: { name: role } } }
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userAdminSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
    ])
    return jsonWithRequestId({
      success: true,
      data: users,
      pagination: {
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/users', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('create', 'user')) {
      return jsonWithRequestId({ error: '无权创建用户' }, requestId, { status: 403 })
    }
    if (ability.cannot('update', 'role')) {
      return jsonWithRequestId({ error: '无权为用户分配角色' }, requestId, { status: 403 })
    }
    const body: unknown = await request.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId({ error: parsed.error.issues[0]?.message || '用户信息不正确' }, requestId, { status: 400 })
    }
    const password = await bcrypt.hash(parsed.data.password, 10)
    const created = await prisma.$transaction(async (tx) => {
      await assertRolesExist(tx, parsed.data.roleIds)
      await assertManagerAssignment(tx, undefined, parsed.data.managerId)
      const user = await tx.user.create({
        data: {
          username: parsed.data.username,
          email: parsed.data.email,
          password,
          realName: parsed.data.realName,
          phone: nullableValue(parsed.data.phone),
          department: nullableValue(parsed.data.department),
          position: nullableValue(parsed.data.position),
          manager: parsed.data.managerId ? { connect: { id: parsed.data.managerId } } : undefined,
          roles: { create: parsed.data.roleIds.map((roleId) => ({ roleId })) },
        },
        select: userAdminSelect,
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        afterData: userAuditSnapshot(user),
        requestId,
      })
      return user
    })
    return jsonWithRequestId({ success: true, data: created }, requestId, { status: 201 })
  } catch (error) {
    if (error instanceof UserAdminError) {
      return jsonWithRequestId({ error: error.message }, requestId, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return jsonWithRequestId({ error: '用户名或邮箱已存在' }, requestId, { status: 409 })
    }
    return serverErrorResponse(error, 'POST /api/users', requestId)
  }
}
