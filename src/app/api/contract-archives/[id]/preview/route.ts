import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }
    const archive = await prisma.contractArchive.findUnique({
      where: { id: params.id },
      include: { customer: { select: { salesId: true, operationManagerId: true } } },
    })
    if (!archive) {
      return jsonWithRequestId({ error: '合同备案不存在' }, requestId, { status: 404 })
    }
    const ability = defineAbility(session.user.permissions || [])
    const canRead = archive.customer.salesId === session.user.id
      || archive.customer.operationManagerId === session.user.id
      || ability.can('manage', 'all')
    if (!canRead) {
      return jsonWithRequestId({ error: '无权预览合同文件' }, requestId, { status: 403 })
    }

    const downloadUrl = `/api/contract-archives/${archive.id}/download`
    if (archive.fileType !== 'pdf') {
      return jsonWithRequestId({ error: '仅支持 PDF 文件预览', downloadUrl }, requestId, { status: 400 })
    }
    await recordAuditEvent(prisma, {
      actorId: session.user.id,
      action: 'PREVIEW',
      entityType: 'ContractArchive',
      entityId: archive.id,
      afterData: { fileName: archive.fileName, fileType: archive.fileType },
      reason: 'CONTRACT_FILE_PREVIEWED',
      requestId,
    })
    return jsonWithRequestId({
      success: true,
      data: {
        previewUrl: `${downloadUrl}?inline=1`,
        fileName: archive.fileName,
        fileType: archive.fileType,
      },
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/contract-archives/[id]/preview', requestId)
  }
}
