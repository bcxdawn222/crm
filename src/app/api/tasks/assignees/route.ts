import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { parsePagination } from '@/lib/http/pagination'
import { prisma } from '@/lib/prisma'
import { buildTaskAssigneeWhere, canCreateTask } from '@/lib/tasks/assignee-scope'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = session.user.permissions || []
    const roles = session.user.roles || []
    if (!permissions.includes('task:view') || !canCreateTask(permissions)) {
      return NextResponse.json({ error: 'No permission to select task assignees' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams, { defaultPageSize: 20, maxPageSize: 50 })
    if (!pagination) {
      return NextResponse.json({ error: 'Pagination parameters are invalid' }, { status: 400 })
    }

    const scope = await buildTaskAssigneeWhere(session.user.id, roles)
    if (!scope) {
      return NextResponse.json({ error: 'No permission to select task assignees' }, { status: 403 })
    }

    const keyword = searchParams.get('keyword')?.trim() || ''
    const keywordFilter: Prisma.UserWhereInput = keyword
      ? {
          OR: [
            { realName: { contains: keyword } },
            { username: { contains: keyword } },
            { department: { contains: keyword } },
          ],
        }
      : {}
    const where: Prisma.UserWhereInput = { AND: [scope, keywordFilter] }
    const { page, pageSize } = pagination

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ realName: 'asc' }, { username: 'asc' }],
        select: {
          id: true,
          realName: true,
          username: true,
          department: true,
          position: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        list: users.map((user) => ({
          ...user,
          isSelf: user.id === session.user.id,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Failed to get task assignees:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
