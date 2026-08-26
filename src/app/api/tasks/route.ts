import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { parsePagination } from '@/lib/http/pagination'
import { canCreateTask, findTaskAssigneeWithinScope } from '@/lib/tasks/assignee-scope'
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client'
import { getAccessibleUserIds } from '@/lib/data-permission'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { dateOnlySchema } from '@/lib/http/date-validation'
import { z } from 'zod'

const createTaskSchema = z.object({
  title: z.string().trim().min(1, '任务标题不能为空').max(200),
  description: z.string().max(10000).optional().nullable(),
  assigneeId: z.string().uuid('负责人 ID 格式不正确'),
  dueDate: dateOnlySchema.nullable().optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
})

// GET /api/tasks - Get task list
export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'task')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return NextResponse.json({ error: 'Pagination parameters are invalid' }, { status: 400 })
    }
    const { page, pageSize } = pagination
    const keyword = searchParams.get('keyword') || ''
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''

    // Build query conditions
    const where: Prisma.TaskWhereInput = {}
    
    const accessibleUserIds = await getAccessibleUserIds(session.user.id, session.user.roles)
    if (accessibleUserIds !== null) {
      where.assigneeId = { in: accessibleUserIds }
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
      ]
    }

    // Status filter
    if (status) {
      if (!Object.values(TaskStatus).includes(status as TaskStatus)) {
        return NextResponse.json({ error: 'Task status is invalid' }, { status: 400 })
      }
      where.status = status as TaskStatus
    }

    // Priority filter
    if (priority) {
      if (!Object.values(TaskPriority).includes(priority as TaskPriority)) {
        return NextResponse.json({ error: 'Task priority is invalid' }, { status: 400 })
      }
      where.priority = priority as TaskPriority
    }

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: {
          assignee: { select: { id: true, realName: true } },
          creator: { select: { id: true, realName: true } },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        list: tasks.map((task) => ({
          ...task,
          dueDate: task.endDate,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/tasks', requestId)
  }
}

// POST /api/tasks - Create task
export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const roles = session.user.roles || []
    if (!canCreateTask(permissions)) {
      return NextResponse.json({ error: 'No permission to create task' }, { status: 403 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: '请求内容不是有效 JSON' }, { status: 400 })
    }
    const parsed = createTaskSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '任务参数不正确' },
        { status: 400 },
      )
    }
    const { title, description, assigneeId, dueDate, priority } = parsed.data

    const assignee = await findTaskAssigneeWithinScope(session.user.id, roles, assigneeId)
    if (!assignee) {
      const existingAssignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { status: true },
      })
      if (!existingAssignee || existingAssignee.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Assignee not found or inactive' }, { status: 404 })
      }
      return NextResponse.json({ error: 'No permission to assign this task' }, { status: 403 })
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description,
        assigneeId,
        endDate: dueDate ?? null,
        priority,
        creatorId: session.user.id,
        status: 'TODO',
      }
    })

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task created successfully'
    })
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/tasks', requestId)
  }
}
