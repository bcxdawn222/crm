import { Prisma } from '@prisma/client'


export class PublicPoolHistoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublicPoolHistoryError'
  }
}


export function appendPublicPoolHistory(
  currentHistory: Prisma.JsonValue | null,
  event: Prisma.JsonObject
): Prisma.InputJsonValue {
  if (currentHistory === null) {
    return [event]
  }
  if (!Array.isArray(currentHistory)) {
    throw new PublicPoolHistoryError('公海流转历史格式异常，请先修复该客户数据')
  }
  return [...currentHistory, event] as Prisma.InputJsonValue
}
