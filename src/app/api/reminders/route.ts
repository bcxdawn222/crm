import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { buildDataFilter, getAccessibleUserIds } from '@/lib/data-permission'
import { getRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { loadReminderRows } from '@/lib/reminders/queries'

// GET /api/reminders - Get reminder list
export async function GET(request: Request) {
  const requestId = getRequestId(request)
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
    const accessibleUserIds = await getAccessibleUserIds(userId, roles)

    const now = new Date()
    const [overdueFollowUp, expiringContracts, upcomingVisits, plannedFollowUps] =
      await loadReminderRows({ customerWhere: dataFilter, accessibleUserIds, now })

    // Format response data
    const formatOverdueFollowUp = overdueFollowUp.map(c => ({
      type: 'OVERDUE_FOLLOWUP',
      customerId: c.id,
      customerName: c.name,
      company: c.company,
      phone: c.phone,
      lastFollowUpAt: c.lastFollowUpAt,
      daysSinceLastFollowUp: c.lastFollowUpAt 
        ? Math.floor((now.getTime() - new Date(c.lastFollowUpAt).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      priority: 'HIGH',
      message: c.lastFollowUpAt 
        ? `已${Math.floor((now.getTime() - new Date(c.lastFollowUpAt).getTime()) / (1000 * 60 * 60 * 24))}天未跟进`
        : '从未跟进',
    }))

    const formatExpiringContracts = expiringContracts.map(c => ({
      type: 'EXPIRING_CONTRACT',
      customerId: c.id,
      customerName: c.name,
      company: c.company,
      contractEndDate: c.contractEndDate,
      contractAmount: c.contractAmount,
      daysUntilExpiry: c.contractEndDate 
        ? Math.ceil((new Date(c.contractEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      priority: 'HIGH',
      message: `合同将在${Math.ceil((new Date(c.contractEndDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}天后到期`,
    }))

    const formatUpcomingVisits = upcomingVisits.map(c => ({
      type: 'UPCOMING_VISIT',
      customerId: c.id,
      customerName: c.name,
      company: c.company,
      nextVisitAt: c.nextVisitAt,
      visitFrequency: c.visitFrequency,
      daysUntilVisit: c.nextVisitAt 
        ? Math.ceil((new Date(c.nextVisitAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      priority: 'MEDIUM',
      message: `计划${Math.ceil((new Date(c.nextVisitAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}天后回访`,
    }))

    const formatPlannedFollowUps = plannedFollowUps.map(f => ({
      type: 'PLANNED_FOLLOWUP',
      followUpId: f.id,
      customerId: f.customerId,
      customerName: f.customer.name,
      company: f.customer.company,
      nextFollowUpAt: f.nextFollowUpAt,
      content: f.content,
      daysUntilFollowUp: f.nextFollowUpAt 
        ? Math.ceil((new Date(f.nextFollowUpAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      priority: 'MEDIUM',
      message: `计划${Math.ceil((new Date(f.nextFollowUpAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}天后跟进`,
    }))

    return NextResponse.json({
      success: true,
      data: {
        overdueFollowUp: formatOverdueFollowUp,
        expiringContracts: formatExpiringContracts,
        upcomingVisits: formatUpcomingVisits,
        plannedFollowUps: formatPlannedFollowUps,
        summary: {
          totalOverdue: overdueFollowUp.length,
          totalExpiring: expiringContracts.length,
          totalUpcomingVisits: upcomingVisits.length,
          totalPlannedFollowUps: plannedFollowUps.length,
          totalReminders: overdueFollowUp.length + expiringContracts.length + upcomingVisits.length + plannedFollowUps.length,
        }
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/reminders', requestId)
  }
}
