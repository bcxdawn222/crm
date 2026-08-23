import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { prisma } from '@/lib/prisma'


interface RouteContext {
  params: { id: string }
}

export async function PATCH(_: Request, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  const ability = defineAbility(session.user.permissions || [])
  if (ability.cannot('read', 'message')) {
    return NextResponse.json({ error: '无权操作消息' }, { status: 403 })
  }
  const result = await prisma.message.updateMany({
    where: { id: params.id, receiverId: session.user.id },
    data: { isRead: true, readAt: new Date() },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: '消息不存在' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  const ability = defineAbility(session.user.permissions || [])
  if (ability.cannot('delete', 'message')) {
    return NextResponse.json({ error: '无权删除消息' }, { status: 403 })
  }
  const result = await prisma.message.deleteMany({
    where: { id: params.id, receiverId: session.user.id },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: '消息不存在' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
