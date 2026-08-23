import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'
import { prisma } from '@/lib/prisma'


const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})


export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ability = defineAbility(session.user.permissions)
    if (ability.cannot('read', 'customer')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json({ error: '提醒天数必须在 1 到 365 之间' }, { status: 400 })
    }

    const today = new Date()
    const reminderDate = new Date(today)
    reminderDate.setDate(today.getDate() + parsed.data.days)
    const where: Prisma.CustomerWhereInput = {
      status: 'COOPERATING',
      contractEndDate: { lte: reminderDate, gte: today },
      ...await buildDataFilter(session.user.id, session.user.roles),
    }
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { contractEndDate: 'asc' },
      include: {
        sales: { select: { id: true, realName: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: customers,
      message: `Found ${customers.length} customers with expiring contracts`,
    })
  } catch (error) {
    console.error('Failed to get renewal reminders:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
