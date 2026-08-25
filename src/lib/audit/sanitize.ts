import { Prisma } from '@prisma/client'

const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|credential|ossurl|osskey|signedurl|signature)/i
const PRIVATE_KEY = /^(phone|email|address|idcard|identitynumber|bankaccount)$/i

function maskPrivateValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (key.toLowerCase() === 'phone' && typeof value === 'string') {
    return value.length > 4 ? `***${value.slice(-4)}` : '***'
  }
  if (key.toLowerCase() === 'email' && typeof value === 'string') {
    const separator = value.indexOf('@')
    return separator > 0 ? `${value.slice(0, 1)}***${value.slice(separator)}` : '***'
  }
  return '[已脱敏]'
}

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
      if (SENSITIVE_KEY.test(key)) result[key] = '[REDACTED]'
      else if (PRIVATE_KEY.test(key)) result[key] = maskPrivateValue(key, child)
      else result[key] = normalize(child)
    }
    return result
  }
  return value
}

export function sanitizeAuditData(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined
  return normalize(value) as Prisma.InputJsonValue
}
