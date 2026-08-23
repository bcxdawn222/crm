import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'

// POST /api/telemarketing/convert - 将电销记录转入我的客户
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('create', 'customer')) {
      return NextResponse.json({ error: 'No permission to convert to customer' }, { status: 403 })
    }

    const body = await request.json()
    const { telemarketingId, level, source, notes } = body

    if (!telemarketingId) {
      return NextResponse.json({ error: 'Telemarketing ID is required' }, { status: 400 })
    }

    // Get the telemarketing record
    const telemarketing = await prisma.telemarketingList.findUnique({
      where: { id: telemarketingId },
    })

    if (!telemarketing) {
      return NextResponse.json({ error: 'Telemarketing record not found' }, { status: 404 })
    }

    // Check ownership
    if (telemarketing.salesId !== session.user.id) {
      return NextResponse.json({ error: 'No permission to convert this record' }, { status: 403 })
    }

    // Check if already converted
    if (telemarketing.customerId) {
      return NextResponse.json({ error: 'Already converted to customer' }, { status: 400 })
    }

    // Create customer from telemarketing record
    const customer = await prisma.customer.create({
      data: {
        name: telemarketing.name,
        company: telemarketing.company,
        phone: telemarketing.phone,
        level: level || 'POTENTIAL',
        source: source || 'COLD_CALL',
        notes: notes || telemarketing.notes,
        salesId: session.user.id,
        isPublic: false,
        status: 'ACTIVE',
      }
    })

    // Update telemarketing record
    await prisma.telemarketingList.update({
      where: { id: telemarketingId },
      data: {
        customerId: customer.id,
        isEffective: true,
        status: 'CONVERTED',
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        customer,
        telemarketing: telemarketing,
      },
      message: 'Successfully converted to customer'
    })
  } catch (error: any) {
    console.error('Failed to convert telemarketing to customer:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}
