import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { ContractArchiveError, createContractArchive } from '@/lib/contracts/archive'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { parsePagination } from '@/lib/http/pagination'
import { prisma } from '@/lib/prisma'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
])
const CONTRACT_TYPES = ['SALES', 'SERVICE', 'COOPERATION', 'OTHER'] as const
const optionalDate = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.coerce.date().optional()
)
const optionalAmount = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.coerce.number().min(0).max(99_999_999.99).optional()
)
const metadataSchema = z.object({
  contractName: z.string().trim().min(1, '合同名称为必填项').max(200),
  contractType: z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.enum(CONTRACT_TYPES).optional()
  ),
  signDate: optionalDate,
  effectiveDate: optionalDate,
  expiryDate: optionalDate,
  contractAmount: optionalAmount,
  remarks: z.string().trim().max(10_000).optional(),
}).refine(
  (data) => !data.effectiveDate || !data.expiryDate || data.expiryDate >= data.effectiveDate,
  '合同到期日期不能早于生效日期'
)

async function findCustomer(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, salesId: true, operationManagerId: true },
  })
}

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
    const ability = defineAbility(session.user.permissions || [])
    const customer = await findCustomer(params.id)
    if (!customer) {
      return jsonWithRequestId({ error: '客户不存在' }, requestId, { status: 404 })
    }
    const canView = customer.salesId === session.user.id
      || customer.operationManagerId === session.user.id
      || ability.can('manage', 'all')
    if (!canView) {
      return jsonWithRequestId({ error: '无权查看合同备案' }, requestId, { status: 403 })
    }

    const searchParams = new URL(request.url).searchParams
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return jsonWithRequestId({ error: '分页参数不正确' }, requestId, { status: 400 })
    }
    const where: Prisma.ContractArchiveWhereInput = { customerId: params.id }
    if (searchParams.get('showAllVersions') !== 'true') where.isLatest = true

    const [total, archives] = await prisma.$transaction([
      prisma.contractArchive.count({ where }),
      prisma.contractArchive.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { archivedUser: { select: { id: true, realName: true } } },
      }),
    ])
    const contractNames = [...new Set(archives.map((archive) => archive.contractName))]
    const counts = contractNames.length === 0 ? [] : await prisma.contractArchive.groupBy({
      by: ['contractName'],
      where: { customerId: params.id, contractName: { in: contractNames } },
      _count: { _all: true },
    })
    const countByName = new Map(counts.map((item) => [item.contractName, item._count._all]))
    const list = archives.map((archive) => ({
      ...archive,
      totalVersions: countByName.get(archive.contractName) ?? 1,
      hasOldVersions: (countByName.get(archive.contractName) ?? 1) > 1,
    }))

    return jsonWithRequestId({
      success: true,
      data: {
        list,
        total,
        ...pagination,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/customers/[id]/contract-archives', requestId)
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    const customer = await findCustomer(params.id)
    if (!customer) {
      return jsonWithRequestId({ error: '客户不存在' }, requestId, { status: 404 })
    }
    if (customer.salesId !== session.user.id && ability.cannot('manage', 'all')) {
      return jsonWithRequestId({ error: '无权上传合同备案' }, requestId, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return jsonWithRequestId({ error: '上传内容不是有效表单' }, requestId, { status: 400 })
    }
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return jsonWithRequestId({ error: '请选择合同文件' }, requestId, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return jsonWithRequestId({ error: '合同文件必须在 50MB 以内' }, requestId, { status: 400 })
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return jsonWithRequestId({ error: '仅支持 PDF、Word、JPG、PNG 文件' }, requestId, { status: 400 })
    }
    const parsed = metadataSchema.safeParse({
      contractName: formData.get('contractName'),
      contractType: formData.get('contractType'),
      signDate: formData.get('signDate'),
      effectiveDate: formData.get('effectiveDate'),
      expiryDate: formData.get('expiryDate'),
      contractAmount: formData.get('contractAmount'),
      remarks: formData.get('remarks'),
    })
    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.error.issues[0]?.message ?? '合同信息不正确', requestId },
        requestId,
        { status: 400 }
      )
    }

    const { archive, replayed } = await createContractArchive({
      ...parsed.data,
      customerId: params.id,
      fileName: file.name,
      fileType: file.name.split('.').pop()?.toLowerCase() || 'bin',
      fileSize: file.size,
      file: Buffer.from(await file.arrayBuffer()),
      actorId: session.user.id,
      requestId,
    })
    return jsonWithRequestId({
      success: true,
      data: archive,
      replayed,
      message: replayed ? '合同备案已存在，返回原记录' : '合同备案成功',
    }, requestId, { status: replayed ? 200 : 201 })
  } catch (error) {
    if (error instanceof ContractArchiveError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code, requestId },
        requestId,
        { status: error.status }
      )
    }
    return serverErrorResponse(error, 'POST /api/customers/[id]/contract-archives', requestId)
  }
}
