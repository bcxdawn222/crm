import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'
import { parsePagination } from '@/lib/http/pagination'
import { CustomerLevel, CustomerSource, CustomerStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

const optionalText = (max: number) => z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.string().trim().max(max).optional(),
)

const customerCreateSchema = z.object({
  name: z.string().trim().min(1, '请输入客户姓名').max(100),
  company: optionalText(200),
  phone: z.string().trim().min(3, '联系电话格式不正确').max(20),
  email: z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().trim().email('邮箱格式不正确').max(100).optional(),
  ),
  address: optionalText(500),
  category: optionalText(20),
  source: optionalText(50),
  notes: optionalText(10_000),
})

// GET /api/customers - Get customer list
export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }

    // Check permissions
    const permissions = (session.user?.permissions as string[]) || []
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return jsonWithRequestId({ error: '当前账号未配置客户查看权限' }, requestId, { status: 403 })
    }
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'customer')) {
      return jsonWithRequestId({ error: '无权查看客户信息' }, requestId, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return jsonWithRequestId({ error: '分页参数不正确' }, requestId, { status: 400 })
    }
    const { page, pageSize } = pagination
    const keyword = searchParams.get('keyword') || ''
    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''
    const publicPool = searchParams.get('publicPool') === 'true'

    // Build query conditions
    const where: Prisma.CustomerWhereInput = {}
    
    // If querying public pool
    if (publicPool) {
      where.isPublic = true
    } else {
      // Apply the data filter for every role. Admin/finance return an empty
      // filter, while roles without a declared scope return an empty set.
      const roles = session.user.roles || []
      const dataFilter = await buildDataFilter(session.user.id, roles)
      Object.assign(where, dataFilter)
      where.isPublic = false
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { company: { contains: keyword } },
        { phone: { contains: keyword } },
        { email: { contains: keyword } },
      ]
    }

    // Category filter (level field)
    if (category) {
      const levelMap: Record<string, CustomerLevel> = {
        '潜在客户': 'POTENTIAL',
        '普通客户': 'NORMAL',
        '重要客户': 'IMPORTANT',
        'VIP客户': 'VIP',
      }
      where.level = levelMap[category] || category
    }

    // Status filter
    if (status) {
      if (!Object.values(CustomerStatus).includes(status as CustomerStatus)) {
        return NextResponse.json({ error: 'Customer status is invalid' }, { status: 400 })
      }
      where.status = status as CustomerStatus
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: {
          sales: { select: { id: true, realName: true } },
          _count: { select: { followUps: true, orders: true } },
          followUps: {
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ])

    // Map level to category
    const levelMap: Record<string, string> = {
      'POTENTIAL': '潜在客户',
      'NORMAL': '普通客户',
      'IMPORTANT': '重要客户',
      'VIP': 'VIP客户',
    }

    const listWithCategory = customers.map(c => ({
      ...c,
      category: levelMap[c.level as string] || c.level,
    }))

    return NextResponse.json({
      success: true,
      data: {
        list: listWithCategory,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/customers', requestId)
  }
}

// POST /api/customers - Create customer
export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('create', 'customer')) {
      return NextResponse.json({ error: 'No permission to create customer' }, { status: 403 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    }
    const parsed = customerCreateSchema.safeParse(payload)
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message ?? '客户信息不正确' },
        requestId,
        { status: 400 },
      )
    }
    const { name, company, phone, email, address, category, source, notes } = parsed.data

    // Check if already exists
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone },
          ...(email ? [{ email }] : []),
        ]
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Customer already exists' }, { status: 400 })
    }

    // Map category to level
    const categoryMap: Record<string, CustomerLevel> = {
      '潜在客户': 'POTENTIAL',
      '普通客户': 'NORMAL',
      '重要客户': 'IMPORTANT',
      'VIP客户': 'VIP',
    }

    // Create customer
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name,
          company,
          phone,
          email,
          address,
          level: category ? categoryMap[category] || CustomerLevel.POTENTIAL : CustomerLevel.POTENTIAL,
          source: Object.values(CustomerSource).includes(source as CustomerSource)
            ? source as CustomerSource
            : CustomerSource.OTHER,
          notes,
          salesId: session.user.id,
          isPublic: false,
          status: CustomerStatus.ACTIVE,
        }
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'CREATE',
        entityType: 'Customer',
        entityId: created.id,
        afterData: created,
        reason: 'CUSTOMER_CREATED',
        requestId,
      })
      return created
    })

    return jsonWithRequestId({
      success: true,
      data: customer,
      message: 'Customer created successfully'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/customers', requestId)
  }
}
