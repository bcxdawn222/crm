import { randomUUID } from 'crypto'

import { CustomerLevel, CustomerSource, Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import { z } from 'zod'

import { recordAuditEvent } from '@/lib/audit/record'
import { prisma } from '@/lib/prisma'

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 1000
const IMPORT_BATCH_SIZE = 200
const SUPPORTED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx'])

const FIELD_MAPPING = {
  '姓名': 'name',
  name: 'name',
  '公司': 'company',
  company: 'company',
  '公司名称': 'company',
  '电话': 'phone',
  phone: 'phone',
  '联系电话': 'phone',
  '邮箱': 'email',
  email: 'email',
  '邮箱地址': 'email',
  '地址': 'address',
  address: 'address',
  '联系地址': 'address',
  '分类': 'category',
  category: 'category',
  '客户分类': 'category',
  '来源': 'source',
  source: 'source',
  '客户来源': 'source',
  '备注': 'notes',
  notes: 'notes',
  '备注信息': 'notes',
} as const

type ImportField = (typeof FIELD_MAPPING)[keyof typeof FIELD_MAPPING]
type MappedRow = Partial<Record<ImportField, string>>

const rawRowSchema = z.record(z.unknown())
const customerRowSchema = z.object({
  name: z.string().trim().max(100, '姓名不能超过 100 个字符').default(''),
  company: z.string().trim().max(200, '公司不能超过 200 个字符').optional(),
  phone: z.string().trim().max(20, '电话不能超过 20 个字符').optional(),
  email: z.string().trim().email('邮箱格式不正确').max(100, '邮箱不能超过 100 个字符').optional(),
  address: z.string().trim().max(500, '地址不能超过 500 个字符').optional(),
  category: z.string().trim().max(20).default('潜在客户'),
  source: z.string().trim().max(50).default('其他'),
  notes: z.string().trim().max(10_000, '备注不能超过 10000 个字符').optional(),
})

export class CustomerImportValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(errors[0] ?? '导入文件校验失败')
    this.name = 'CustomerImportValidationError'
  }
}

export class CustomerImportConflictError extends Error {
  constructor(readonly conflictCount: number) {
    super(`导入数据中有 ${conflictCount} 条客户与系统现有电话或邮箱重复`)
    this.name = 'CustomerImportConflictError'
  }
}

function fileExtension(fileName: string): string {
  const separator = fileName.lastIndexOf('.')
  return separator >= 0 ? fileName.slice(separator).toLowerCase() : ''
}

function mapLevel(category: string): CustomerLevel | null {
  const levels: Record<string, CustomerLevel> = {
    '潜在客户': CustomerLevel.POTENTIAL,
    '普通客户': CustomerLevel.NORMAL,
    '重要客户': CustomerLevel.IMPORTANT,
    'VIP客户': CustomerLevel.VIP,
  }
  if (Object.values(CustomerLevel).includes(category as CustomerLevel)) {
    return category as CustomerLevel
  }
  return levels[category] ?? null
}

function mapSource(source: string): CustomerSource | null {
  const sources: Record<string, CustomerSource> = {
    '网站': CustomerSource.WEBSITE,
    '转介绍': CustomerSource.REFERRAL,
    '广告': CustomerSource.ADVERTISEMENT,
    '展会': CustomerSource.EXHIBITION,
    '电话': CustomerSource.COLD_CALL,
    '社交媒体': CustomerSource.SOCIAL_MEDIA,
    '其他': CustomerSource.OTHER,
  }
  if (Object.values(CustomerSource).includes(source as CustomerSource)) {
    return source as CustomerSource
  }
  return sources[source] ?? null
}

function mapRawRow(row: unknown): MappedRow | null {
  const parsed = rawRowSchema.safeParse(row)
  if (!parsed.success) return null

  const mapped: MappedRow = {}
  for (const [rawKey, rawValue] of Object.entries(parsed.data)) {
    const key = FIELD_MAPPING[rawKey.trim() as keyof typeof FIELD_MAPPING]
    if (!key || rawValue === null || rawValue === undefined) continue
    const value = String(rawValue).trim()
    if (value) mapped[key] = value
  }
  return mapped
}

async function parseImportRows(file: File): Promise<Prisma.CustomerCreateManyInput[]> {
  if (!file.name || !SUPPORTED_EXTENSIONS.has(fileExtension(file.name))) {
    throw new CustomerImportValidationError(['仅支持 .xlsx、.xls 或 .csv 文件'])
  }
  if (file.size <= 0 || file.size > MAX_IMPORT_FILE_BYTES) {
    throw new CustomerImportValidationError(['导入文件不能为空且不能超过 5 MB'])
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
  } catch {
    throw new CustomerImportValidationError(['文件无法解析，请检查文件格式是否正确'])
  }
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
  if (!worksheet) {
    throw new CustomerImportValidationError(['文件中没有可读取的工作表'])
  }

  const rows = XLSX.utils.sheet_to_json<unknown>(worksheet, { defval: null, raw: false })
  if (rows.length === 0) {
    throw new CustomerImportValidationError(['导入文件没有数据行'])
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new CustomerImportValidationError([`单次最多导入 ${MAX_IMPORT_ROWS} 条记录`])
  }

  const errors: string[] = []
  const customers: Prisma.CustomerCreateManyInput[] = []
  const phones = new Set<string>()
  const emails = new Set<string>()

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const mapped = mapRawRow(row)
    if (!mapped) {
      errors.push(`第 ${rowNumber} 行：数据格式不正确`)
      return
    }
    const parsed = customerRowSchema.safeParse(mapped)
    if (!parsed.success) {
      errors.push(`第 ${rowNumber} 行：${parsed.error.issues[0]?.message ?? '字段校验失败'}`)
      return
    }
    const level = mapLevel(parsed.data.category)
    const source = mapSource(parsed.data.source)
    if (!level) {
      errors.push(`第 ${rowNumber} 行：客户分类不在允许范围内`)
      return
    }
    if (!source) {
      errors.push(`第 ${rowNumber} 行：客户来源不在允许范围内`)
      return
    }

    const emailKey = parsed.data.email?.toLowerCase()
    if ((parsed.data.phone && phones.has(parsed.data.phone)) || (emailKey && emails.has(emailKey))) {
      errors.push(`第 ${rowNumber} 行：电话或邮箱在当前文件中重复`)
      return
    }
    if (parsed.data.phone) phones.add(parsed.data.phone)
    if (emailKey) emails.add(emailKey)

    customers.push({
      id: randomUUID(),
      name: parsed.data.name,
      company: parsed.data.company || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      level,
      source,
      status: 'ACTIVE',
      salesId: '',
      notes: parsed.data.notes || null,
      isPublic: false,
    })
  })

  if (errors.length > 0) throw new CustomerImportValidationError(errors)
  return customers
}

export async function importCustomers(input: {
  file: File
  actorId: string
  requestId: string
}): Promise<string[]> {
  const parsedCustomers = await parseImportRows(input.file)
  const customers = parsedCustomers.map((customer) => ({ ...customer, salesId: input.actorId }))
  const phones = customers.map((customer) => customer.phone).filter((phone): phone is string => Boolean(phone))
  const emails = customers.map((customer) => customer.email).filter((email): email is string => Boolean(email))
  const lockName = `crm_customer_import:${process.env.CRM_PROFILE ?? 'stable'}`

  return prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<Array<{ acquired: number | bigint | null }>>`
      SELECT GET_LOCK(${lockName}, 10) AS acquired
    `
    const acquired = Number(lockRows[0]?.acquired ?? 0) === 1
    if (!acquired) {
      throw new Error('客户导入队列繁忙，未能取得数据库写入锁')
    }

    try {
      const conflicts = await tx.customer.findMany({
        where: { OR: [{ phone: { in: phones } }, { email: { in: emails } }] },
        select: { id: true },
      })
      if (conflicts.length > 0) throw new CustomerImportConflictError(conflicts.length)

      for (let index = 0; index < customers.length; index += IMPORT_BATCH_SIZE) {
        await tx.customer.createMany({ data: customers.slice(index, index + IMPORT_BATCH_SIZE) })
      }
      const customerIds = customers.map((customer) => customer.id as string)
      await recordAuditEvent(tx, {
        actorId: input.actorId,
        action: 'IMPORT',
        entityType: 'CustomerImport',
        entityId: input.requestId,
        afterData: {
          customerIds,
          count: customerIds.length,
          batchCount: Math.ceil(customerIds.length / IMPORT_BATCH_SIZE),
        },
        reason: 'CUSTOMERS_IMPORTED',
        requestId: input.requestId,
      })
      return customerIds
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
