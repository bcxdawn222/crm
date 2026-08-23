import { randomUUID } from 'crypto'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'


const root = path.resolve(
  process.env.CRM_UPLOAD_DIR || path.join(process.cwd(), 'storage', process.env.CRM_PROFILE || 'stable'),
)

export interface StoredFile {
  key: string
  absolutePath: string
}

function resolveKey(key: string): string {
  const absolutePath = path.resolve(root, key)
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error('文件路径不合法')
  }
  return absolutePath
}

export async function storeSharedFile(data: Buffer, originalName: string): Promise<StoredFile> {
  const extension = path.extname(originalName).toLowerCase().slice(0, 12)
  const key = `shared/${new Date().getFullYear()}/${randomUUID()}${extension}`
  const absolutePath = resolveKey(key)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, data)
  return { key, absolutePath }
}

export async function readSharedFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key))
}

export async function removeSharedFile(key: string): Promise<void> {
  await unlink(resolveKey(key))
}

export async function restoreSharedFile(key: string, data: Buffer): Promise<void> {
  const absolutePath = resolveKey(key)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, data)
}
