import { createHash, randomUUID } from 'crypto'

import { Prisma } from '@prisma/client'

import { recordAuditEvent } from '@/lib/audit/record'
import {
  deleteFile,
  generateFileKey,
  readContractFile,
  restoreContractFile,
  saveFile,
} from '@/lib/fileStorage'
import { prisma } from '@/lib/prisma'

export interface CreateContractArchiveInput {
  customerId: string
  contractName: string
  contractType?: string
  signDate?: Date
  effectiveDate?: Date
  expiryDate?: Date
  contractAmount?: number
  remarks?: string
  fileName: string
  fileType: string
  fileSize: number
  file: Buffer
  actorId: string
  requestId: string
}

export class ContractArchiveError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
    this.name = 'ContractArchiveError'
  }
}

function contentHash(file: Buffer): string {
  return createHash('sha256').update(file).digest('hex')
}

function lockName(input: CreateContractArchiveInput): string {
  const identity = `${process.env.CRM_PROFILE ?? 'stable'}:${input.customerId}:${input.contractName}`
  return `crm_contract:${createHash('sha256').update(identity).digest('hex').slice(0, 48)}`
}

function matchesInput(archive: {
  customerId: string
  contractName: string
  fileName: string
  fileSize: number
  fileHash: string
  archivedBy: string
}, input: CreateContractArchiveInput, hash: string): boolean {
  return archive.customerId === input.customerId
    && archive.contractName === input.contractName
    && archive.fileName === input.fileName
    && archive.fileSize === input.fileSize
    && archive.fileHash === hash
    && archive.archivedBy === input.actorId
}

function assertReplayMatches(
  archive: Parameters<typeof matchesInput>[0],
  input: CreateContractArchiveInput,
  hash: string
): void {
  if (!matchesInput(archive, input, hash)) {
    throw new ContractArchiveError('请求号已用于另一份合同文件', 409, 'CONTRACT_REQUEST_CONFLICT')
  }
}

export async function createContractArchive(input: CreateContractArchiveInput) {
  const hash = contentHash(input.file)
  const replay = await prisma.contractArchive.findUnique({ where: { requestId: input.requestId } })
  if (replay) {
    assertReplayMatches(replay, input, hash)
    return { archive: replay, replayed: true }
  }

  const storedKey = generateFileKey(input.customerId, input.fileName)
  await saveFile(input.file, storedKey)
  let keepStoredFile = false
  try {
    const result = await prisma.$transaction(async (tx) => {
      const name = lockName(input)
      const rows = await tx.$queryRaw<Array<{ acquired: number | bigint | null }>>`
        SELECT GET_LOCK(${name}, 10) AS acquired
      `
      if (Number(rows[0]?.acquired ?? 0) !== 1) {
        throw new ContractArchiveError('合同版本正在写入，请稍后重试', 409, 'CONTRACT_LOCK_TIMEOUT')
      }

      try {
        const existingRequest = await tx.contractArchive.findUnique({
          where: { requestId: input.requestId },
        })
        if (existingRequest) {
          assertReplayMatches(existingRequest, input, hash)
          return { archive: existingRequest, replayed: true }
        }

        const latest = await tx.contractArchive.findFirst({
          where: { customerId: input.customerId, contractName: input.contractName, isLatest: true },
          orderBy: { version: 'desc' },
        })
        if (latest) {
          await tx.contractArchive.update({ where: { id: latest.id }, data: { isLatest: false } })
        }
        const archive = await tx.contractArchive.create({
          data: {
            archiveNo: `CA-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
            requestId: input.requestId,
            customerId: input.customerId,
            version: (latest?.version ?? 0) + 1,
            isLatest: true,
            parentArchiveId: latest?.id ?? null,
            contractName: input.contractName,
            contractType: input.contractType || null,
            signDate: input.signDate || null,
            effectiveDate: input.effectiveDate || null,
            expiryDate: input.expiryDate || null,
            contractAmount: input.contractAmount,
            fileName: input.fileName,
            ossUrl: storedKey,
            ossKey: storedKey,
            fileSize: input.fileSize,
            fileType: input.fileType,
            fileHash: hash,
            archivedBy: input.actorId,
            remarks: input.remarks || null,
          },
        })
        await recordAuditEvent(tx, {
          actorId: input.actorId,
          action: 'CREATE',
          entityType: 'ContractArchive',
          entityId: archive.id,
          beforeData: latest,
          afterData: archive,
          reason: 'CONTRACT_ARCHIVED',
          requestId: input.requestId,
        })
        return { archive, replayed: false }
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${name})`
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 })

    if (result.replayed) await deleteFile(storedKey)
    else keepStoredFile = true
    return result
  } catch (error) {
    if (!keepStoredFile) {
      try {
        await deleteFile(storedKey)
      } catch (cleanupError) {
        console.error('合同备案失败后的文件清理失败', cleanupError)
      }
    }
    if (error instanceof ContractArchiveError) throw error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ContractArchiveError('合同版本或请求号冲突，请刷新后重试', 409, 'CONTRACT_CONFLICT')
    }
    throw error
  }
}

export async function deleteContractArchive(input: {
  archiveId: string
  actorId: string
  requestId: string
}) {
  const archive = await prisma.contractArchive.findUnique({ where: { id: input.archiveId } })
  if (!archive) throw new ContractArchiveError('合同备案不存在', 404, 'CONTRACT_NOT_FOUND')

  const originalFile = await readContractFile(archive.ossKey)
  await deleteFile(archive.ossKey)
  try {
    await prisma.$transaction(async (tx) => {
      await tx.contractArchive.delete({ where: { id: archive.id } })
      let promotedId: string | null = null
      if (archive.isLatest) {
        const previous = await tx.contractArchive.findFirst({
          where: { customerId: archive.customerId, contractName: archive.contractName },
          orderBy: { version: 'desc' },
        })
        if (previous) {
          await tx.contractArchive.update({ where: { id: previous.id }, data: { isLatest: true } })
          promotedId = previous.id
        }
      }
      await recordAuditEvent(tx, {
        actorId: input.actorId,
        action: 'DELETE',
        entityType: 'ContractArchive',
        entityId: archive.id,
        beforeData: archive,
        afterData: { promotedId },
        reason: 'CONTRACT_ARCHIVE_DELETED',
        requestId: input.requestId,
      })
    })
    return archive
  } catch (error) {
    await restoreContractFile(archive.ossKey, originalFile)
    throw error
  }
}
