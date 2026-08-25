import { access, readdir } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic'

type DependencyState = 'reachable' | 'unreachable' | 'not_checked'
type MigrationState = 'current' | 'pending' | 'drift' | 'unavailable' | 'not_checked'

export async function GET(request: Request) {
  const startedAt = Date.now()
  const profile = process.env.CRM_PROFILE || 'stable'
  const requestId = getRequestId(request)
  const deep = new URL(request.url).searchParams.get('deep') === '1'
  if (deep) {
    try {
      const session = await auth()
      if (!session?.user?.id) return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    } catch (error) {
      return serverErrorResponse(error, 'GET /api/health authentication', requestId)
    }
  }

  let database: DependencyState = 'reachable'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    database = 'unreachable'
  }

  let storage: DependencyState = 'not_checked'
  let migrations: MigrationState = 'not_checked'
  if (deep) {
    const storagePath = path.resolve(
      process.env.CRM_UPLOAD_DIR || path.join(process.cwd(), 'storage', profile),
    )
    try {
      await access(storagePath, constants.R_OK | constants.W_OK)
      storage = 'reachable'
    } catch {
      storage = 'unreachable'
    }
    try {
      const migrationRoot = path.join(process.cwd(), 'prisma', 'migrations')
      const entries = await readdir(migrationRoot, { withFileTypes: true })
      const expected = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name))
      const rows = await prisma.$queryRaw<Array<{ migrationName: string }>>`
        SELECT migration_name AS migrationName
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `
      const applied = new Set(rows.map((row) => row.migrationName))
      const hasPending = [...expected].some((name) => !applied.has(name))
      const hasDrift = [...applied].some((name) => !expected.has(name))
      migrations = hasPending ? 'pending' : hasDrift ? 'drift' : 'current'
    } catch {
      migrations = 'unavailable'
    }
  }

  const healthy = database === 'reachable'
    && (!deep || (storage === 'reachable' && migrations === 'current'))
  return jsonWithRequestId(
    {
      status: healthy ? 'ok' : 'degraded',
      profile,
      version: process.env.CRM_BUILD_VERSION || process.env.npm_package_version || 'development',
      commit: process.env.CRM_BUILD_COMMIT || 'unknown',
      uptimeSeconds: Math.floor(process.uptime()),
      database,
      storage,
      migrations,
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
    },
    requestId,
    { status: healthy ? 200 : 503 },
  )
}
