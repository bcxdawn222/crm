import { FileCategory } from '@prisma/client'
import { NextResponse } from 'next/server'

import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { removeSharedFile, storeSharedFile } from '@/lib/files/storage'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { writeServerError } from '@/lib/logger'
import { parsePagination } from '@/lib/http/pagination'
import { prisma } from '@/lib/prisma'
import { getAccessibleUserIds } from '@/lib/data-permission'
import type { Prisma } from '@prisma/client'


export const dynamic = 'force-dynamic'
const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
])

function categoryFor(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return FileCategory.IMAGE
  return FileCategory.DOCUMENT
}

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('read', 'file')) return jsonWithRequestId({ error: '无权查看文件' }, requestId, { status: 403 })
    const pagination = parsePagination(new URL(request.url).searchParams, { defaultPageSize: 20 })
    if (!pagination) return jsonWithRequestId({ error: '分页参数不正确' }, requestId, { status: 400 })
    const accessibleUserIds = await getAccessibleUserIds(session.user.id, session.user.roles)
    const where: Prisma.FileWhereInput = accessibleUserIds === null
      ? {}
      : { uploadedBy: { in: accessibleUserIds } }
    const [list, total] = await prisma.$transaction([
      prisma.file.findMany({
        where,
        select: { id: true, originalName: true, size: true, mimeType: true, category: true, downloadCount: true, createdAt: true, uploader: { select: { realName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.file.count({ where }),
    ])
    return jsonWithRequestId({ success: true, data: { list, total, ...pagination } }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/files', requestId)
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  let storedKey: string | undefined
  try {
    const session = await auth()
    if (!session?.user?.id) return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('create', 'file')) return jsonWithRequestId({ error: '无权上传文件' }, requestId, { status: 403 })
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return jsonWithRequestId({ error: '请选择文件' }, requestId, { status: 400 })
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return jsonWithRequestId({ error: '文件大小必须在 20MB 以内' }, requestId, { status: 400 })
    if (!ALLOWED_MIME_TYPES.has(file.type)) return jsonWithRequestId({ error: '不支持该文件类型' }, requestId, { status: 400 })
    const stored = await storeSharedFile(Buffer.from(await file.arrayBuffer()), file.name)
    storedKey = stored.key
    const created = await prisma.$transaction(async (db) => {
      const record = await db.file.create({
        data: { name: file.name, originalName: file.name, url: `/api/files/pending`, path: stored.key, size: file.size, mimeType: file.type, category: categoryFor(file.type), uploadedBy: session.user.id, isPublic: true },
      })
      const updated = await db.file.update({ where: { id: record.id }, data: { url: `/api/files/${record.id}` } })
      await recordAuditEvent(db, { actorId: session.user.id, action: 'FILE_UPLOADED', entityType: 'File', entityId: updated.id, afterData: { name: updated.originalName, size: updated.size, mimeType: updated.mimeType }, requestId })
      return updated
    })
    return jsonWithRequestId({ success: true, data: created }, requestId, { status: 201 })
  } catch (error) {
    if (storedKey) {
      try {
        await removeSharedFile(storedKey)
      } catch (cleanupError) {
        await writeServerError('POST /api/files cleanup', cleanupError, requestId)
      }
    }
    return serverErrorResponse(error, 'POST /api/files', requestId)
  }
}
