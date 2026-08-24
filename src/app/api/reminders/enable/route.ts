import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'

// POST /api/reminders/enable - Enable reminders for a customer
export async function POST(request: Request) {
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

    const body = await request.json()
    const { customerId } = body

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

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
    console.error('Failed to enable reminders:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
