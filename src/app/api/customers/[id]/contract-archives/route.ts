import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { uploadToOSS, generateOSSKey } from '@/lib/oss'
import { saveFile, generateFileKey } from '@/lib/fileStorage'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/customers/[id]/contract-archives/route.ts - 获取客户的合同备案列表
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = params.id
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const showAllVersions = searchParams.get('showAllVersions') === 'true'

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    
    // Get customer to check ownership
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        sales: { select: { id: true } },
        operationManager: { select: { id: true } }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Permission check: only sales owner, operation manager, or admin can view
    const isOwner = customer.salesId === session.user.id
    const isOpManager = customer.operationManagerId === session.user.id
    const isAdmin = ability.can('manage', 'all')
    
    if (!isOwner && !isOpManager && !isAdmin) {
      return NextResponse.json({ error: 'No permission to view' }, { status: 403 })
    }

    // Build query conditions
    const where: any = { customerId }
    
    // By default, only show latest versions
    if (!showAllVersions) {
      where.isLatest = true
    }

    // Query total count
    const total = await prisma.contractArchive.count({ where })

    // Query list with pagination
    const archives = await prisma.contractArchive.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        archivedUser: {
          select: {
            id: true,
            realName: true,
          }
        }
      }
    })

    // Check if each archive has old versions
    const archivesWithVersionInfo = await Promise.all(
      archives.map(async (archive) => {
        const versionCount = await prisma.contractArchive.count({
          where: {
            customerId: archive.customerId,
            contractName: archive.contractName,
          }
        })
        return {
          ...archive,
          hasOldVersions: versionCount > 1,
          totalVersions: versionCount,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        list: archivesWithVersionInfo,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/customers/[id]/contract-archives', requestId)
  }
}

// POST /api/customers/[id]/contract-archives - 上传合同备案
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = params.id

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    
    // Get customer to check ownership
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Permission check: only sales owner or admin can upload
    const isOwner = customer.salesId === session.user.id
    const isAdmin = ability.can('manage', 'all')
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'No permission to upload' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const contractName = formData.get('contractName') as string
    const contractType = formData.get('contractType') as string
    const signDate = formData.get('signDate') as string
    const effectiveDate = formData.get('effectiveDate') as string
    const expiryDate = formData.get('expiryDate') as string
    const contractAmount = formData.get('contractAmount') as string
    const remarks = formData.get('remarks') as string

    if (!file || !contractName) {
      return NextResponse.json({ 
        error: 'File and contract name are required' 
      }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: '不支持的文件类型，仅支持 PDF、Word、JPG、PNG 格式' 
      }, { status: 400 })
    }

    // Validate file size (50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: '文件大小不能超过 50MB' 
      }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 保存文件到本地存储
    const fileKey = generateFileKey(customerId, file.name)
    const fileUrl = await saveFile(buffer, fileKey)

    // Check if there's an existing archive with the same contract name
    const existingArchive = await prisma.contractArchive.findFirst({
      where: {
        customerId,
        contractName,
        isLatest: true
      },
      orderBy: { version: 'desc' }
    })

    // Generate archive number
    const archiveNo = `CA-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Create new archive record
    const newArchive = await prisma.$transaction(async (tx) => {
      const created = await tx.contractArchive.create({
        data: {
          archiveNo,
          customerId,
          version: existingArchive ? existingArchive.version + 1 : 1,
          isLatest: true,
          parentArchiveId: existingArchive?.id || null,
          contractName,
          contractType: contractType || null,
          signDate: signDate ? new Date(signDate) : null,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          contractAmount: contractAmount ? parseFloat(contractAmount) : null,
          fileName: file.name,
          ossUrl: fileUrl,
          ossKey: fileKey,
          fileSize: file.size,
          fileType: file.name.split('.').pop() || 'bin',
          archivedBy: session.user.id,
          remarks: remarks || null,
        }
      })

      if (existingArchive) {
        await tx.contractArchive.update({
          where: { id: existingArchive.id },
          data: { isLatest: false }
        })
      }
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'CREATE',
        entityType: 'ContractArchive',
        entityId: created.id,
        beforeData: existingArchive,
        afterData: created,
        reason: 'CONTRACT_ARCHIVED',
        requestId,
      })
      return created
    })

    return jsonWithRequestId({
      success: true,
      data: newArchive,
      message: '合同备案成功'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'POST /api/customers/[id]/contract-archives', requestId)
  }
}
