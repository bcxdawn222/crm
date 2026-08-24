import { recordAuditEvent } from '@/lib/audit/record'
import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import { prisma } from '@/lib/prisma'
import {
  systemSettingKeys,
  systemSettingsFromRows,
  updateSystemSettingsSchema,
} from '@/lib/settings/admin'


export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('read', 'setting') && ability.cannot('update', 'setting')) {
      return jsonWithRequestId({ error: '无权查看系统设置' }, requestId, { status: 403 })
    }
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: [...systemSettingKeys] } },
      select: { key: true, value: true },
    })
    return jsonWithRequestId({ success: true, data: systemSettingsFromRows(rows) }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'GET /api/settings', requestId)
  }
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: '未授权' }, requestId, { status: 401 })
    }
    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('update', 'setting')) {
      return jsonWithRequestId({ error: '无权修改系统设置' }, requestId, { status: 403 })
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonWithRequestId({ error: '请求内容不是有效 JSON' }, requestId, { status: 400 })
    }
    const parsed = updateSystemSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithRequestId({ error: parsed.error.issues[0]?.message || '系统设置不正确' }, requestId, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existingRows = await tx.systemSetting.findMany({
        where: { key: { in: [...systemSettingKeys] } },
        select: { key: true, value: true },
      })
      const before = systemSettingsFromRows(existingRows)
      for (const key of systemSettingKeys) {
        await tx.systemSetting.upsert({
          where: { key },
          create: { key, value: parsed.data[key], updatedBy: session.user.id },
          update: { value: parsed.data[key], updatedBy: session.user.id },
        })
      }
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: 'SETTINGS_UPDATED',
        entityType: 'SystemSetting',
        entityId: 'global',
        beforeData: before,
        afterData: parsed.data,
        requestId,
      })
      return parsed.data
    })
    return jsonWithRequestId({ success: true, data: updated }, requestId)
  } catch (error) {
    return serverErrorResponse(error, 'PUT /api/settings', requestId)
  }
}
