import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter } from '@/lib/data-permission'

// POST /api/reminders/disable - Disable reminders for a customer
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
      return NextResponse.json({ error: 'No permission to disable reminders' }, { status: 403 })
    }

    const body = await request.json()
    const { customerId, reason } = body

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

    // Update customer to disable reminders
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        reminderDisabled: true,
        reminderDisabledReason: reason || null,
        reminderDisabledAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Reminders disabled successfully',
      data: {
        customerId: updatedCustomer.id,
        reminderDisabled: updatedCustomer.reminderDisabled,
        reminderDisabledReason: updatedCustomer.reminderDisabledReason,
        reminderDisabledAt: updatedCustomer.reminderDisabledAt,
      }
    })
  } catch (error) {
    console.error('Failed to disable reminders:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
