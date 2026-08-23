import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'

// GET /api/finance/reports/summary - Get financial summary
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'order')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    // Build query conditions
    const where: any = {}
    
    // Sales can only view their own orders
    if (session.user.roles.includes('sales')) {
      where.salesId = session.user.id
    }

    // Date range filter
    if (startDate && endDate) {
      where.signDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    // Query all orders
    const orders = await prisma.order.findMany({
      where,
      select: {
        contractAmount: true,
        paidAmount: true,
        unpaidAmount: true,
      }
    })

    // Calculate statistics
    const totalOrders = orders.length
    const totalAmount = orders.reduce((sum, order) => sum + order.contractAmount.toNumber(), 0)
    const paidAmount = orders.reduce((sum, order) => sum + order.paidAmount.toNumber(), 0)
    const unpaidAmount = orders.reduce((sum, order) => sum + order.unpaidAmount.toNumber(), 0)
    const completionRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        totalOrders,
        totalAmount,
        paidAmount,
        unpaidAmount,
        completionRate,
      }
    })
  } catch (error) {
    console.error('Failed to get financial summary:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
