import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { handlePublicPoolClaim } from '@/lib/public-pool/claim-handler'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { parsePagination } from '@/lib/http/pagination'
import type { Prisma } from '@prisma/client'

// GET /api/public-pool - 获取公海池客户列表
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
    if (ability.cannot('read', 'customer')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return NextResponse.json({ error: 'Pagination parameters are invalid' }, { status: 400 })
    }
    const { page, pageSize } = pagination
    const keyword = searchParams.get('keyword') || ''

    // Build query conditions
    const where: Prisma.CustomerWhereInput = {
      isPublic: true,
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { company: { contains: keyword } },
        { phone: { contains: keyword } },
      ]
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ publicPoolEnteredAt: 'desc' }, { id: 'asc' }],
        include: {
          sales: { select: { id: true, realName: true } },
          _count: { select: { followUps: true, orders: true } },
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
      // 确保返回新增字段
      publicPoolEnteredAt: c.publicPoolEnteredAt,
      publicPoolReason: c.publicPoolReason,
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
    return serverErrorResponse(error, 'GET /api/public-pool', requestId)
  }
}

export async function POST(request: Request) {
  return handlePublicPoolClaim(request)
}
