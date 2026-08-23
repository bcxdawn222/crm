import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { prisma } from '@/lib/prisma'


export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  const ability = defineAbility(session.user.permissions || [])
  if (ability.cannot('read', 'message')) {
    return NextResponse.json({ error: '无权操作消息' }, { status: 403 })
  }
  const result = await prisma.message.updateMany({
    where: { receiverId: session.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  return NextResponse.json({ success: true, data: { updated: result.count } })
}
