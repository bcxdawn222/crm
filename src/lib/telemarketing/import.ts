import { randomUUID } from 'crypto'

import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import { z } from 'zod'

import { recordAuditEvent } from '@/lib/audit/record'
import { canAccessSalesData } from '@/lib/data-permission'
import { normalizeCrmPhone } from '@/lib/http/phone'
import { prisma } from '@/lib/prisma'
import {
  canAssignTelemarketingOwner,
  findTelemarketingOwnerByLabel,
} from '@/lib/telemarketing/scope'

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 1000
const IMPORT_BATCH_SIZE = 200
const SUPPORTED_EXTENSIONS = new Set(['.csv', '.xls', '.xlsx'])

const FIELD_MAPPING = {
  '姓名': 'name',
  name: 'name',
  '公司': 'company',
  company: 'company',
  '电话': 'phone',
  phone: 'phone',
  '职位': 'position',
  position: 'position',
  '行业': 'industry',
  industry: 'industry',
  '来源': 'source',
  source: 'source',
  '备注': 'notes',
  notes: 'notes',
  '销售': 'sales',
  sales: 'sales',
  '负责人': 'sales',
} as const

type ImportField = (typeof FIELD_MAPPING)[keyof typeof FIELD_MAPPING]
type MappedRow = Partial<Record<ImportField, string>>

const rawRowSchema = z.record(z.unknown())
const rowSchema = z.object({
  name: z.string().trim().max(100, '姓名不能超过 100 个字符').default(''),
  company: z.string().trim().max(200, '公司不能超过 200 个字符').optional(),
  phone: z.string().trim().max(20, '电话不能超过 20 个字符').default(''),
  position: z.string().trim().max(50, '职位不能超过 50 个字符').optional(),
  industry: z.string().trim().max(50, '行业不能超过 50 个字符').optional(),
  source: z.string().trim().max(100, '来源不能超过 100 个字符').optional(),
  notes: z.string().trim().max(10_000, '备注不能超过 10000 个字符').optional(),
  sales: z.string().trim().max(100, '销售不能超过 100 个字符').optional(),
})

export class TelemarketingImportValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(errors[0] ?? '导入文件校验失败')
    this.name = 'TelemarketingImportValidationError'
  }
}

export class TelemarketingImportConflictError extends Error {
  constructor(readonly conflictCount: number) {
    super(`导入数据中有 ${conflictCount} 条电话与系统现有电销名单重复`)
    this.name = 'TelemarketingImportConflictError'
  }
}

export class TelemarketingImportScopeError extends Error {
  constructor(message: string, readonly status: 400 | 403) {
    super(message)
    this.name = 'TelemarketingImportScopeError'
  }
}

function fileExtension(fileName: string): string {
  const separator = fileName.lastIndexOf('.')
  return separator >= 0 ? fileName.slice(separator).toLowerCase() : ''
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

async function resolveRowOwner(input: {
  actorId: string
  actorRoles: readonly string[]
  formSalesId?: string
  rowSales?: string
}): Promise<string> {
  if (!canAssignTelemarketingOwner(input.actorRoles)) {
    return input.actorId
  }

  let salesId: string | undefined
  if (input.rowSales) {
    const matched = await findTelemarketingOwnerByLabel(input.rowSales)
    if ('error' in matched) {
      throw new TelemarketingImportValidationError([matched.error])
    }
    salesId = matched.id
  } else if (input.formSalesId) {
    salesId = input.formSalesId
  }

  if (!salesId) {
    throw new TelemarketingImportScopeError('请指定负责人', 400)
  }
  if (!(await canAccessSalesData(input.actorId, input.actorRoles, salesId))) {
    throw new TelemarketingImportScopeError('无权指定该负责人', 403)
  }
  return salesId
}

async function parseImportRows(input: {
  file: File
  actorId: string
  actorRoles: readonly string[]
  formSalesId?: string
}): Promise<Prisma.TelemarketingListCreateManyInput[]> {
  if (!input.file.name || !SUPPORTED_EXTENSIONS.has(fileExtension(input.file.name))) {
    throw new TelemarketingImportValidationError(['仅支持 .xlsx、.xls 或 .csv 文件'])
  }
  if (input.file.size <= 0 || input.file.size > MAX_IMPORT_FILE_BYTES) {
    throw new TelemarketingImportValidationError(['导入文件不能为空且不能超过 5 MB'])
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(Buffer.from(await input.file.arrayBuffer()), { type: 'buffer' })
  } catch {
    throw new TelemarketingImportValidationError(['文件无法解析，请检查文件格式是否正确'])
  }
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
  if (!worksheet) {
    throw new TelemarketingImportValidationError(['文件中没有可读取的工作表'])
  }

  const rows = XLSX.utils.sheet_to_json<unknown>(worksheet, { defval: null, raw: false })
  if (rows.length === 0) {
    throw new TelemarketingImportValidationError(['导入文件没有数据行'])
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new TelemarketingImportValidationError([`单次最多导入 ${MAX_IMPORT_ROWS} 条记录`])
  }

  const errors: string[] = []
  const records: Prisma.TelemarketingListCreateManyInput[] = []
  const phones = new Set<string>()

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2
    const mapped = mapRawRow(rows[index])
    if (!mapped) {
      errors.push(`第 ${rowNumber} 行：数据格式不正确`)
      continue
    }
    const parsed = rowSchema.safeParse(mapped)
    if (!parsed.success) {
      errors.push(`第 ${rowNumber} 行：${parsed.error.issues[0]?.message ?? '字段校验失败'}`)
      continue
    }
    if (Object.keys(mapped).length === 0) continue
    const phone = normalizeCrmPhone(parsed.data.phone)
    if (phone) {
      if (phones.has(phone)) {
        errors.push(`第 ${rowNumber} 行：电话在当前文件中重复`)
        continue
      }
      phones.add(phone)
    }

    try {
      const salesId = await resolveRowOwner({
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        formSalesId: input.formSalesId,
        rowSales: canAssignTelemarketingOwner(input.actorRoles) ? parsed.data.sales : undefined,
      })
      records.push({
        id: randomUUID(),
        name: parsed.data.name,
        company: parsed.data.company || null,
        phone,
        position: parsed.data.position || null,
        industry: parsed.data.industry || null,
        source: parsed.data.source || null,
        notes: parsed.data.notes || null,
        salesId,
        status: 'PENDING',
        isEffective: false,
      })
    } catch (error) {
      if (error instanceof TelemarketingImportValidationError) {
        errors.push(`第 ${rowNumber} 行：${error.errors[0] ?? error.message}`)
        continue
      }
      throw error
    }
  }

  if (errors.length > 0) throw new TelemarketingImportValidationError(errors)
  return records
}

export async function importTelemarketingLists(input: {
  file: File
  actorId: string
  actorRoles: readonly string[]
  formSalesId?: string
  requestId: string
}): Promise<string[]> {
  const records = await parseImportRows(input)
  const phones = records.map((record) => record.phone)
  const lockName = `crm_telemarketing_import:${process.env.CRM_PROFILE ?? 'stable'}`

  return prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<Array<{ acquired: number | bigint | null }>>`
      SELECT GET_LOCK(${lockName}, 10) AS acquired
    `
    const acquired = Number(lockRows[0]?.acquired ?? 0) === 1
    if (!acquired) {
      throw new Error('电销导入队列繁忙，未能取得数据库写入锁')
    }

    try {
      const uniquePhones = phones.filter((phone) => phone.length > 0)
      const conflicts = uniquePhones.length === 0
        ? []
        : await tx.telemarketingList.findMany({
            where: { phone: { in: uniquePhones } },
            select: { id: true },
          })
      if (conflicts.length > 0) throw new TelemarketingImportConflictError(conflicts.length)

      for (let index = 0; index < records.length; index += IMPORT_BATCH_SIZE) {
        await tx.telemarketingList.createMany({ data: records.slice(index, index + IMPORT_BATCH_SIZE) })
      }
      const ids = records.map((record) => record.id as string)
      await recordAuditEvent(tx, {
        actorId: input.actorId,
        action: 'IMPORT',
        entityType: 'TelemarketingImport',
        entityId: input.requestId,
        afterData: {
          ids,
          count: ids.length,
          batchCount: Math.ceil(ids.length / IMPORT_BATCH_SIZE),
        },
        reason: 'TELEMARKETING_IMPORTED',
        requestId: input.requestId,
      })
      return ids
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
