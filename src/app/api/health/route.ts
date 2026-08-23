import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  const profile = process.env.CRM_PROFILE || 'stable'

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      profile,
      database: 'reachable',
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
    })
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        profile,
        database: 'unreachable',
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startedAt,
      },
      { status: 503 },
    )
  }
}
