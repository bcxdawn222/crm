import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// POST /api/customers/transfer - Transfer customer to current user
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
      return NextResponse.json({ error: 'No permission to transfer customer' }, { status: 403 })
    }

    const body = await request.json()
    const { customerId } = body

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 })
    }

    // Get the customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Check if customer is in public pool
    if (!customer.isPublic) {
      return NextResponse.json({ error: 'Customer is not in public pool' }, { status: 400 })
    }

    // Transfer customer to current user
    const updatedCustomer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: customerId },
        data: {
          salesId: session.user.id,
          isPublic: false,
          status: 'ACTIVE',
        },
      })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'TRANSFER_FROM_PUBLIC_POOL',
        entityType: 'Customer',
        entityId: customerId,
        beforeData: customer,
        afterData: updated,
        reason: 'PUBLIC_POOL_TRANSFER',
        requestId,
      })
      return updated
    })

    return jsonWithRequestId({
      success: true,
      data: updatedCustomer,
      message: 'Customer transferred successfully'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/customers/transfer', requestId)
  }
}
