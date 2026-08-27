import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { enableReminderSchema } from '@/app/api/reminders/request-schema'

// POST /api/reminders/enable - Enable reminders for a customer
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
    if (ability.cannot('update', 'customer')) {
      return NextResponse.json({ error: 'No permission to enable reminders' }, { status: 403 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: '请求内容不是有效 JSON' }, { status: 400 })
    }
    const parsed = enableReminderSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '提醒参数不正确' }, { status: 400 })
    }
    const { customerId } = parsed.data

    // Verify user has permission to modify this customer
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        ...await buildDataFilter(session.user.id, session.user.roles),
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found or no permission' }, { status: 404 })
    }

    // Update customer to enable reminders
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        reminderDisabled: false,
        reminderDisabledReason: null,
        reminderDisabledAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Reminders enabled successfully',
      data: {
        customerId: updatedCustomer.id,
        reminderDisabled: updatedCustomer.reminderDisabled,
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/reminders/enable', requestId)
  }
}
