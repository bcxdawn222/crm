import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { parsePagination } from '@/lib/http/pagination'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  const ability = defineAbility(session.user.permissions || [])
  if (ability.cannot('read', 'message')) {
    return NextResponse.json({ error: '无权查看消息' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const pagination = parsePagination(searchParams)
  if (!pagination) {
    return NextResponse.json({ error: '分页参数不正确' }, { status: 400 })
  }
  const where = { receiverId: session.user.id }
  const [list, total, unread] = await prisma.$transaction([
    prisma.message.findMany({
      where,
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        isRead: true,
        readAt: true,
        createdAt: true,
        sender: { select: { realName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.message.count({ where }),
    prisma.message.count({ where: { ...where, isRead: false } }),
  ])
  return NextResponse.json({
    success: true,
    data: { list, total, unread, page: pagination.page, pageSize: pagination.pageSize },
  })
}
