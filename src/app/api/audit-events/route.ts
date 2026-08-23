import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { prisma } from '@/lib/prisma'
import { parsePagination } from '@/lib/http/pagination'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })

    const ability = defineAbility(session.user.permissions as string[])
    if (!ability.can('manage', 'all')) {
      return jsonWithRequestId({ error: '无权查看审计记录' }, requestId, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return jsonWithRequestId({ error: '分页参数不正确' }, requestId, { status: 400 })
    }
    const action = searchParams.get('action') || undefined
    const entityType = searchParams.get('entityType') || undefined
    const entityId = searchParams.get('entityId') || undefined
    const actorId = searchParams.get('actorId') || undefined
    const where = { action, entityType, entityId, actorId }

    const [total, list] = await prisma.$transaction([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, realName: true, username: true } } },
      }),
    ])

    return jsonWithRequestId({
      success: true,
      data: {
        list,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/audit-events', requestId)
  }
}
