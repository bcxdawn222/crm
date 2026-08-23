import { appendFile, mkdir } from 'fs/promises'
import path from 'path'

const logDirectory = path.join(process.cwd(), 'logs')

function serializeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ''}`
  return String(error)
}

export async function writeServerError(
  context: string,
  error: unknown,
  requestId: string
): Promise<void> {
  const line = `${new Date().toISOString()} ERROR requestId=${requestId} context=${context} ${serializeError(error)}\n`
  await mkdir(logDirectory, { recursive: true })
  await appendFile(path.join(logDirectory, 'server-errors.log'), line, 'utf8')
  console.error(line)
}
