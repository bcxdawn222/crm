import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { deleteFromOSS } from '@/lib/oss'
import { deleteFile } from '@/lib/fileStorage'
import { recordAuditEvent } from '@/lib/audit/record'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// DELETE /api/contract-archives/[id] - 删除合同备案
export async function DELETE(
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

    // Permission check: only sales owner or admin can delete
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    
    const isOwner = archive.customer.salesId === session.user.id
    const isAdmin = ability.can('manage', 'all')
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'No permission to delete' }, { status: 403 })
    }

    // 删除本地文件(可选,保留用于审计)
    try {
      await deleteFile(archive.ossKey)
    } catch (error) {
      console.warn('Failed to delete file:', error)
      // Continue even if file deletion fails
    }

    // Delete archive record
    await prisma.$transaction(async (tx) => {
      await tx.contractArchive.delete({ where: { id: archiveId } })
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'DELETE',
        entityType: 'ContractArchive',
        entityId: archiveId,
        beforeData: archive,
        reason: 'CONTRACT_ARCHIVE_DELETED',
        requestId,
      })
    })

    return jsonWithRequestId({
      success: true,
      message: '合同备案已删除'
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'DELETE /api/contract-archives/[id]', requestId)
  }
}
