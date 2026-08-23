import { Prisma } from '@prisma/client'

const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|credential|ossurl|osskey|signedurl|signature)/i

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return Number((value as { toNumber: () => number }).toNumber())
  }
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : normalize(child)
    }
    return result
  }
  return value
}

export function sanitizeAuditData(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  return normalize(value) as Prisma.InputJsonValue
}
