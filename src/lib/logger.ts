import { appendFile, mkdir } from 'fs/promises'
import path from 'path'

const logDirectory = path.join(process.cwd(), 'logs')
const REDACTIONS: readonly [RegExp, string][] = [
  [/\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[REDACTED]'],
  [/\b(cookie|authorization|password|secret|token)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]'],
  [/(mysql|mariadb):\/\/([^:\s/]+):([^@\s/]+)@/gi, '$1://$2:[REDACTED]@'],
  [/\b(ALIYUN_OSS_ACCESS_KEY|ALIYUN_OSS_SECRET_KEY)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]'],
]

function redact(text: string): string {
  return REDACTIONS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text)
}

function serializeError(error: unknown): string {
  if (error instanceof Error) return redact(`${error.name}: ${error.message}\n${error.stack ?? ''}`)
  return redact(String(error))
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
