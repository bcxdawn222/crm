import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

// GET /api/contract-archives/[id]/versions - 获取合同备案的版本历史
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const archiveId = params.id

    // Get the archive to find its contract name and customer
    const currentArchive = await prisma.contractArchive.findUnique({
      where: { id: archiveId }
    })

    if (!currentArchive) {
      return NextResponse.json({ error: 'Archive not found' }, { status: 404 })
    }

    // Get all versions of this contract (same customer + same contract name)
    const versions = await prisma.contractArchive.findMany({
      where: {
        customerId: currentArchive.customerId,
        contractName: currentArchive.contractName
      },
      orderBy: { version: 'desc' },
      include: {
        archivedUser: {
          select: {
            id: true,
            realName: true
          }
        }
      }
    })

    return jsonWithRequestId({
      success: true,
      data: versions
    }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/contract-archives/[id]/versions', requestId)
  }
}
