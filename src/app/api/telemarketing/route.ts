import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'

// GET /api/telemarketing - 获取电销名单列表
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
      return NextResponse.json({ error: 'No permission to access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const status = searchParams.get('status')
    const isEffective = searchParams.get('isEffective')
    const keyword = searchParams.get('keyword')

    // Build query conditions
    const where: any = {
      salesId: session.user.id
    }

    // Filter by status
    if (status && status !== 'all') {
      where.status = status
    }

    // Filter by effectiveness
    if (isEffective !== null && isEffective !== undefined) {
      where.isEffective = isEffective === 'true'
    }

    // Keyword search
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { company: { contains: keyword } },
        { phone: { contains: keyword } },
      ]
    }

    // Query total count
    const total = await prisma.telemarketingList.count({ where })

    // Query list
    const list = await prisma.telemarketingList.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        list,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error: any) {
    console.error('Failed to get telemarketing list:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}

// POST /api/telemarketing - 创建电销记录
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
      return NextResponse.json({ error: 'No permission to create telemarketing record' }, { status: 403 })
    }

    const body = await request.json()
    const { name, company, phone, position, industry, source, notes } = body

    // Validate required fields
    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    // Create telemarketing record
    const record = await prisma.telemarketingList.create({
      data: {
        name,
        company,
        phone,
        position,
        industry,
        source,
        notes,
        salesId: session.user.id,
      }
    })

    return NextResponse.json({
      success: true,
      data: record,
      message: 'Telemarketing record created successfully'
    })
  } catch (error: any) {
    console.error('Failed to create telemarketing record:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}

// PUT /api/telemarketing/[id] - 更新电销记录
export async function PUT(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    // Check ownership
    const record = await prisma.telemarketingList.findUnique({
      where: { id }
    })

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    if (record.salesId !== session.user.id) {
      return NextResponse.json({ error: 'No permission to update this record' }, { status: 403 })
    }

    const body = await request.json()
    const { callTimes, lastCallAt, callDuration, status, result, notes, isEffective } = body

    // Update record
    const updated = await prisma.telemarketingList.update({
      where: { id },
      data: {
        callTimes,
        lastCallAt: lastCallAt ? new Date(lastCallAt) : undefined,
        callDuration,
        status,
        result,
        notes,
        isEffective,
      }
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Telemarketing record updated successfully'
    })
  } catch (error: any) {
    console.error('Failed to update telemarketing record:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}

// DELETE /api/telemarketing/[id] - 删除电销记录
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    // Check ownership
    const record = await prisma.telemarketingList.findUnique({
      where: { id }
    })

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    if (record.salesId !== session.user.id) {
      return NextResponse.json({ error: 'No permission to delete this record' }, { status: 403 })
    }

    // Delete record
    await prisma.telemarketingList.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Telemarketing record deleted successfully'
    })
  } catch (error: any) {
    console.error('Failed to delete telemarketing record:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}
