import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const queryLoggingEnabled = process.env.CRM_PRISMA_QUERY_LOG === '1'
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: queryLoggingEnabled ? [{ emit: 'stdout', level: 'query' }] : [],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
