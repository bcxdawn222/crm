import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'

// GET /api/roles - 获取角色列表
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - Admin can view roles
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('read', 'role')) {
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: {
            users: true,
            permissions: true
          }
        },
        permissions: {
          include: {
            permission: {
              select: {
                code: true,
                name: true,
                module: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Format response
    const formattedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      userCount: role._count.users,
      permissionCount: role._count.permissions,
      permissions: role.permissions.map(rp => rp.permission.code),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    }))

    return NextResponse.json({
      success: true,
      data: formattedRoles
    })
  } catch (error: any) {
    console.error('Failed to get roles:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}
