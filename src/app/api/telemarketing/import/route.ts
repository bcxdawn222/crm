import { auth } from '@/lib/auth'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'
import {
  TelemarketingImportConflictError,
  TelemarketingImportScopeError,
  TelemarketingImportValidationError,
  importTelemarketingLists,
} from '@/lib/telemarketing/import'
import { canAssignTelemarketingOwner } from '@/lib/telemarketing/scope'

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }
    if (!session.user.permissions.includes('lead:create')) {
      return jsonWithRequestId({ error: '无权导入电销名单' }, requestId, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return jsonWithRequestId({ error: '上传内容不是有效的表单文件' }, requestId, { status: 400 })
    }
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return jsonWithRequestId({ error: '请选择需要导入的文件' }, requestId, { status: 400 })
    }

    const rawSalesId = formData.get('salesId')
    const formSalesId = typeof rawSalesId === 'string' && rawSalesId.trim() ? rawSalesId.trim() : undefined
    if (formSalesId && !canAssignTelemarketingOwner(session.user.roles)) {
      return jsonWithRequestId({ error: '无权指定电销负责人' }, requestId, { status: 403 })
    }

    const ids = await importTelemarketingLists({
      file,
      actorId: session.user.id,
      actorRoles: session.user.roles,
      formSalesId,
      requestId,
    })
    return jsonWithRequestId({
      success: true,
      data: { count: ids.length, ids },
      message: `成功导入 ${ids.length} 条电销记录`,
    }, requestId, { status: 201 })
  } catch (error) {
    if (error instanceof TelemarketingImportValidationError) {
      return jsonWithRequestId(
        { error: error.message, errors: error.errors, requestId },
        requestId,
        { status: 400 }
      )
    }
    if (error instanceof TelemarketingImportConflictError) {
      return jsonWithRequestId(
        { error: error.message, code: 'TELEMARKETING_IMPORT_CONFLICT', requestId },
        requestId,
        { status: 409 }
      )
    }
    if (error instanceof TelemarketingImportScopeError) {
      return jsonWithRequestId({ error: error.message, requestId }, requestId, { status: error.status })
    }
    return serverErrorResponse(error, 'POST /api/telemarketing/import', requestId)
  }
}
