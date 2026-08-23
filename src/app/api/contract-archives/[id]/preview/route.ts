import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { getSignedUrl } from '@/lib/oss'
import { getFileUrl } from '@/lib/fileStorage'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/contract-archives/[id]/preview - 预览合同文件(PDF)
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

    const archiveId = params.id

    // Get archive record
    const archive = await prisma.contractArchive.findUnique({
      where: { id: archiveId },
      include: {
        customer: {
          select: {
            id: true,
            salesId: true,
            operationManagerId: true
          }
        }
      }
    })

    if (!archive) {
      return NextResponse.json({ error: 'Archive not found' }, { status: 404 })
    }

    // Permission check
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    
    const isOwner = archive.customer.salesId === session.user.id
    const isOpManager = archive.customer.operationManagerId === session.user.id
    const isAdmin = ability.can('manage', 'all')
    
    if (!isOwner && !isOpManager && !isAdmin) {
      return NextResponse.json({ error: 'No permission to preview' }, { status: 403 })
    }

    // 仅支持PDF预览
    if (archive.fileType !== 'pdf') {
      return NextResponse.json({ 
        error: '仅支持PDF文件预览',
        downloadUrl: await getFileUrl(archive.ossUrl)
      }, { status: 400 })
    }

    // 生成本地文件URL(本地存储直接返回路径)
    const fileUrl = await getFileUrl(archive.ossUrl)
    await recordAuditEvent(prisma, {
      actorId: session.user.id,
      action: 'PREVIEW',
      entityType: 'ContractArchive',
      entityId: archiveId,
      afterData: { fileName: archive.fileName, fileType: archive.fileType },
      reason: 'CONTRACT_FILE_PREVIEWED',
      requestId,
    })

    return jsonWithRequestId({
      success: true,
      data: {
        previewUrl: fileUrl,
        fileName: archive.fileName,
        fileType: archive.fileType
      }
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/contract-archives/[id]/preview', requestId)
  }
}
