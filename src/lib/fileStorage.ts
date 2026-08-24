import { randomUUID } from 'crypto'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'

const baseUploadDir = process.env.CRM_UPLOAD_DIR
  ? path.resolve(process.env.CRM_UPLOAD_DIR)
  : path.resolve(process.cwd(), 'public', 'uploads')
const contractUploadDir = path.join(baseUploadDir, 'contracts')

function resolveFileKey(key: string): string {
  const absolutePath = path.resolve(contractUploadDir, key)
  if (!absolutePath.startsWith(`${contractUploadDir}${path.sep}`)) {
    throw new Error('合同文件路径不合法')
  }
  return absolutePath
}

export async function saveFile(file: Buffer, key: string): Promise<void> {
  const filePath = resolveFileKey(key)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, file)
}

export async function readContractFile(key: string): Promise<Buffer> {
  return readFile(resolveFileKey(key))
}

export async function deleteFile(key: string): Promise<void> {
  await unlink(resolveFileKey(key))
}

export async function restoreContractFile(key: string, data: Buffer): Promise<void> {
  const filePath = resolveFileKey(key)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, data)
}

export function generateFileKey(customerId: string, originalFilename: string): string {
  const extension = path.extname(originalFilename).toLowerCase().slice(0, 12) || '.bin'
  return `${customerId}/${randomUUID()}${extension}`
}
