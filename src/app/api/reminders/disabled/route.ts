import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'

// GET /api/reminders/disabled - Get list of customers with disabled reminders
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'customer')) {
      return NextResponse.json({ error: 'No permission to access reminders' }, { status: 403 })
    }

    const userId = session.user.id
    const roles = session.user.roles || []

    // Build data filter based on user role
    const dataFilter = await buildDataFilter(userId, roles)

    // Get customers with disabled reminders
    const disabledCustomers = await prisma.customer.findMany({
      where: {
        ...dataFilter,
        reminderDisabled: true,
      },
      include: {
        sales: {
          select: {
            id: true,
            realName: true,
          }
        },
      },
      orderBy: {
        reminderDisabledAt: 'desc',
      },
      take: 100,
    })

    const now = new Date()
    const formattedList = disabledCustomers.map(c => ({
      customerId: c.id,
      customerName: c.name,
      company: c.company,
      phone: c.phone,
      reminderDisabledReason: c.reminderDisabledReason,
      reminderDisabledAt: c.reminderDisabledAt,
      daysSinceDisabled: c.reminderDisabledAt 
        ? Math.floor((now.getTime() - new Date(c.reminderDisabledAt).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }))

    return NextResponse.json({
      success: true,
      data: formattedList,
    })
  } catch (error) {
    console.error('Failed to get disabled reminders:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
