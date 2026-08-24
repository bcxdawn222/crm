import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { parsePagination } from '@/lib/http/pagination'
import { canCreateTask, findTaskAssigneeWithinScope } from '@/lib/tasks/assignee-scope'
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client'
import { getAccessibleUserIds } from '@/lib/data-permission'

// GET /api/tasks - Get task list
export async function GET(request: Request) {
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

    // Query total count
    const total = await prisma.task.count({ where })

    // Query list
    const tasks = await prisma.task.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: {
          select: {
            id: true,
            realName: true,
          }
        },
        creator: {
          select: {
            id: true,
            realName: true,
          }
        }
      }
    })

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
    console.error('Failed to get task list:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/tasks - Create task
export async function POST(request: Request) {
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

    const body = await request.json() as {
      title?: string
      description?: string
      assigneeId?: string
      dueDate?: string | null
      priority?: string
    }
    const { title, description, assigneeId, dueDate, priority } = body

    // Validate required fields
    if (!title?.trim() || !assigneeId) {
      return NextResponse.json({ error: 'Title and assignee are required' }, { status: 400 })
    }

    const normalizedPriority = priority || TaskPriority.MEDIUM
    if (!Object.values(TaskPriority).includes(normalizedPriority as TaskPriority)) {
      return NextResponse.json({ error: 'Task priority is invalid' }, { status: 400 })
    }

    const dueDateValue = dueDate ? new Date(dueDate) : null
    if (dueDateValue && Number.isNaN(dueDateValue.getTime())) {
      return NextResponse.json({ error: 'Task due date is invalid' }, { status: 400 })
    }

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
        endDate: dueDateValue,
        priority: normalizedPriority as TaskPriority,
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
    console.error('Failed to create task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
